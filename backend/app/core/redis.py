"""
Redis client and caching utilities.

This module provides Redis connection management and caching
decorators for async functions.
"""

import asyncio
import functools
import hashlib
import json
import logging
from typing import Any, Callable, Optional, TypeVar, Union

import redis.asyncio as redis
from redis.asyncio import Redis

from app.config import settings

logger = logging.getLogger(__name__)

# Type variable for generic return types
T = TypeVar("T")

# Global Redis client instance
_redis_client: Optional[Redis] = None


async def get_redis_client() -> Redis:
    """
    Get or create the async Redis client.
    
    Returns:
        Redis: Async Redis client instance.
    """
    global _redis_client
    
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
        )
        logger.info("Redis client initialized: %s", settings.REDIS_URL)
    
    return _redis_client


async def close_redis_client() -> None:
    """
    Close the Redis client connection.
    
    Should be called during application shutdown.
    """
    global _redis_client
    
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis client closed")


async def redis_ping() -> bool:
    """
    Check if Redis is available.
    
    Returns:
        bool: True if Redis responds to ping, False otherwise.
    """
    try:
        client = await get_redis_client()
        await client.ping()
        return True
    except Exception as e:
        logger.warning("Redis ping failed: %s", str(e))
        return False


def make_cache_key(*args: Any, prefix: str = "") -> str:
    """
    Generate a cache key from arguments.
    
    Args:
        *args: Arguments to hash into the key.
        prefix: Optional prefix for the key.
    
    Returns:
        str: Cache key string.
    """
    # Serialize arguments to JSON and hash
    serialized = json.dumps(args, sort_keys=True, default=str)
    hash_value = hashlib.md5(serialized.encode()).hexdigest()[:16]
    
    if prefix:
        return f"{prefix}:{hash_value}"
    return hash_value


async def cache_get(key: str) -> Optional[Any]:
    """
    Get a value from cache.
    
    Args:
        key: Cache key.
    
    Returns:
        Cached value or None if not found.
    """
    try:
        client = await get_redis_client()
        value = await client.get(key)
        
        if value is not None:
            return json.loads(value)
        return None
    except Exception as e:
        logger.warning("Cache get failed for key %s: %s", key, str(e))
        return None


async def cache_set(
    key: str,
    value: Any,
    ttl: int = 300,
) -> bool:
    """
    Set a value in cache.
    
    Args:
        key: Cache key.
        value: Value to cache (must be JSON serializable).
        ttl: Time to live in seconds (default 5 minutes).
    
    Returns:
        bool: True if successful, False otherwise.
    """
    try:
        client = await get_redis_client()
        serialized = json.dumps(value, default=str)
        await client.setex(key, ttl, serialized)
        return True
    except Exception as e:
        logger.warning("Cache set failed for key %s: %s", key, str(e))
        return False


async def cache_delete(key: str) -> bool:
    """
    Delete a value from cache.
    
    Args:
        key: Cache key.
    
    Returns:
        bool: True if deleted, False otherwise.
    """
    try:
        client = await get_redis_client()
        await client.delete(key)
        return True
    except Exception as e:
        logger.warning("Cache delete failed for key %s: %s", key, str(e))
        return False


async def cache_delete_pattern(pattern: str) -> int:
    """
    Delete all keys matching a pattern.
    
    Args:
        pattern: Key pattern (e.g., "rag:*").
    
    Returns:
        int: Number of keys deleted.
    """
    try:
        client = await get_redis_client()
        keys = []
        async for key in client.scan_iter(match=pattern):
            keys.append(key)
        
        if keys:
            await client.delete(*keys)
            logger.info("Deleted %d cache keys matching %s", len(keys), pattern)
        
        return len(keys)
    except Exception as e:
        logger.warning("Cache delete pattern failed for %s: %s", pattern, str(e))
        return 0


def cached(
    ttl: int = 300,
    key_prefix: str = "",
    key_builder: Optional[Callable[..., str]] = None,
):
    """
    Decorator for caching async function results in Redis.
    
    Args:
        ttl: Time to live in seconds (default 5 minutes).
        key_prefix: Prefix for cache keys.
        key_builder: Optional custom function to build cache key.
    
    Returns:
        Decorated function with caching.
    
    Example:
        @cached(ttl=300, key_prefix="rag:context")
        async def build_rag_context(query: str, platform: str):
            # ... expensive operation
            return result
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # Use function name + args for key
                prefix = key_prefix or f"cache:{func.__module__}.{func.__name__}"
                cache_key = make_cache_key(*args, **kwargs, prefix=prefix)
            
            # Try to get from cache
            cached_value = await cache_get(cache_key)
            if cached_value is not None:
                logger.debug("Cache hit for key: %s", cache_key)
                return cached_value
            
            # Execute function
            logger.debug("Cache miss for key: %s", cache_key)
            result = await func(*args, **kwargs)
            
            # Store in cache (don't await to avoid blocking)
            if result is not None:
                asyncio.create_task(cache_set(cache_key, result, ttl))
            
            return result
        
        return wrapper
    return decorator


class CacheManager:
    """
    Helper class for managing cache operations with a specific prefix.
    
    Example:
        rag_cache = CacheManager(prefix="rag", default_ttl=300)
        await rag_cache.set("context:123", data)
        data = await rag_cache.get("context:123")
    """
    
    def __init__(self, prefix: str, default_ttl: int = 300):
        """
        Initialize cache manager.
        
        Args:
            prefix: Key prefix for all operations.
            default_ttl: Default TTL in seconds.
        """
        self.prefix = prefix
        self.default_ttl = default_ttl
    
    def _make_key(self, key: str) -> str:
        """Build full key with prefix."""
        return f"{self.prefix}:{key}"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        return await cache_get(self._make_key(key))
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """Set value in cache."""
        return await cache_set(
            self._make_key(key),
            value,
            ttl or self.default_ttl,
        )
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        return await cache_delete(self._make_key(key))
    
    async def clear(self) -> int:
        """Clear all keys with this prefix."""
        return await cache_delete_pattern(f"{self.prefix}:*")


# Pre-configured cache managers for common use cases
rag_cache = CacheManager(prefix="rag", default_ttl=300)  # 5 minutes
knowledge_cache = CacheManager(prefix="knowledge", default_ttl=120)  # 2 minutes
