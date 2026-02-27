/**
 * Placeholder avatar URLs (from design reference).
 * Used when users don't have avatar_url set — pick by name (male/female).
 */

// Male placeholder images (from reference HTML)
const MALE_PLACEHOLDER_URLS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD_GhPGKod3E8opSViWsrBRgIbHxhTuojVJnNxijYvQ1XDuqWZuL9Wd28G0eIzHPj1xCEb0Me7f6jUir8GowK7c83rjzuGgPu9zQAcQ_mvxgRVrrMeQ5wTIbR0iUUEllBU3dK-hK3q3BKVTkyWUJPFn8OFxdu3HA3LK6ipl1U2qKcLYMseQt8_9mg-v9xtmPBwIfTnRwenMHo3Vr6QHcNkzrYswhliynu9b3a8HjikE_p-G-KWh_MaOEHKVEoW9wuPzd64pXIYw5Hs',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDmBGBMNeY1XSEM6MPQBun_8LVJ55Niu3T2JN0dy5N5B9Ully3-LCvymbIeHxHqctquHuEQ8OozQT0gTk0dvWvTiou2RdImK8Flm1dSnISE4pocNh0VHGZ8CTum2YW7LBlv05tNUvcafnXaMglpqAWpE7m3CSem1iq-Ng-yqiVDmNp3h5lmfzEJ_3788SPPWRY1e_I9fX_hD88vvr4Spo0cSQu_GaPpiY9_a5MEG7_fm2MaRGW3pOFGQCwGrbcUQ6QYn1I4Uz4JgCI',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBpq0AnPQ7R8HCvOy6ODFZ_YL5MvE1n-oMNKnbJsUPR0NxdJPlriFVQetYpaTgBILU1Hkc-1RjGNYqjiLTCUej9_OWU8z0-gtVuLJnNeeh6tzryL-e7_ZuYzLXe-mzW6MxDYmUP64W3kFWdmuvfGkZ0PGdHMlxgSj5DGl8IeE16S_k_YI8KDnFH11-hvSLMYd8kIQNVgP7NB0KQErklc55x7mztDZTP2VK43G82gxy9OV3i6f-KR3GtA_TVEHC_w59_QMsItd0BoxE',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBYf4MUOAAd-hk0fxbGDXlnI2vgqwpoGNYCgVKyzkFaSt38DbuBXTKyYbw61ivVfsa5WJRNZIOUMB6kohhsgEOOR-zNoDd0g0WHlLSr97e64wd1v-v6-3aWrYHZsKUcaFE4vu9Zo24Qv3hTQJZL5FasTqq0lnU3JxvpicsuupV_zsd9OsFYCNqEyZbgwdWaY2Njg0MKcVz6DiB0dg_gryJMi96VMOFRqAlynNFCse5DgmjQ1aX3-Opzu9fAF-o3SD1MntFhxyedc08',
]

// Female placeholder images (from reference HTML)
const FEMALE_PLACEHOLDER_URLS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuApZmVfVEj2iVnXnk-qVffQpWJXVNcWweAEqySyH-Tz20keo6X0kJ-Fkd1cBegf4BPCBjCpwVa3SJXwioFyi2ayfnA6QOrY-H1clZQi3ZUoG9F4XJl4HHr2sNll4wJC-b6mt8xg9oXu1kNI2uLGrvhG7gB9FKdsGlzTBwGdrgBctRL9Lii2LUHsF9XfXKaY2p2fvijmkAtKgwLBMBEZAVZhxKQ9-Fq1RWUoQWjrypxONYubvm2BcmmmEEZ62-6XsO_b5RVJ1T-k56s',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCmp7IAnHPMXog6Gc48h2JKrjlW-aimb4DuDw5y40i3BV32uG1hk_9vtLHbMw2RzBFCjAYQ2BrB_M1lJ7IQN8eQ2RkslEhqzL6kmBMrFqZ_k8HB_C1P_fP6ozU5i_V2TIp7AI2YM40iA_zV4T4s5S8CBwoZfZ86HL5OqCa84zBlurgCPfr6k2j2t453QQSa-bqhL_jUDgLCB5O4TI5z53duEh7zPjmC4g4y_YjVzmrvbh-6jOYkhRuZOG_SWzufIma5iO4qnHXvMJ8',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB9k1z22MRpitbphBdBip0k5qANX2zIlGLmzGYBltub4kzgYPdoo1ouBS8vWeb-9IQnCdm9zs_cJQmnnhIci_GoamXUfRKggbpmoJBCPSJQ1CXayyB_VS8rLLyaL2xmKPNRatTQTwbBDACtsSHL5w2OqRHnVyMs_TLx2NQhuPRHk_lhs3zlFlGu7sU6WyczqhlBpYa0HIPwgwxwSmV2gaNn9CDF2v08jaaOTkhW3NuD4O2a4i4lK4X0KKHA2uFWEJWyfnBZ0X63T7M',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCkzmTSwAw1Wgzw3hLUVPFxvr4SAB5yGpoavrrJl39SnbEKKS7lPXw-PQTs_Tpdgl8WDUKubI0xkYVycOD83lShYuMiDKsKJoUWa7PGYpVcVeMPbqa2kAZyxbe29O0TIWjkrZjk7cr5MznNZ2gQ6lSAPjMe5_bioWwfxzwVOR6ZAzR2bUEtfFpI2n9uEl9XFNPopVdKx2MNgbBAwHtKIRX0Hiu2l-lMyMDIUnd1PGvHt4c7J-ghkpJt7X4TdoYpoBCDjzYwl05nwvk',
]

/** Common female first names (lowercase) for placeholder gender guess. */
const FEMALE_FIRST_NAMES = new Set([
  'sarah', 'elena', 'maya', 'olivia', 'emma', 'sophia', 'isabella', 'mia', 'charlotte', 'amelia',
  'harper', 'evelyn', 'abigail', 'emily', 'elizabeth', 'sofia', 'ella', 'madison', 'scarlett',
  'victoria', 'aria', 'grace', 'chloe', 'camila', 'penelope', 'riley', 'layla', 'lillian',
  'nora', 'zoey', 'mila', 'aubrey', 'hannah', 'lily', 'addison', 'eleanor', 'natalie',
  'luna', 'savannah', 'brooklyn', 'leah', 'zoe', 'stella', 'hazel', 'ellie', 'paisley',
  'audrey', 'skylar', 'violet', 'claire', 'bella', 'aurora', 'lucy', 'anna', 'samantha',
  'caroline', 'genesis', 'aaliyah', 'kennedy', 'kinsley', 'allison', 'maya', 'sarah',
  'madeline', 'adeline', 'alexa', 'ariana', 'elena', 'gabriella', 'naomi', 'alice',
  'sadie', 'hailey', 'eva', 'emilia', 'autumn', 'quinn', 'nevaeh', 'piper', 'ruby',
  'serenity', 'willow', 'everly', 'cora', 'kaylee', 'lydia', 'aubrey', 'arianna',
  'eliana', 'peyton', 'melanie', 'gianna', 'isabelle', 'julia', 'valentina', 'nova',
])

/**
 * Simple string hash for deterministic index from name.
 */
function hashString(s: string): number {
  let h = 0
  const str = s.trim().toLowerCase()
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h = (h << 5) - h + c
    h = h & h
  }
  return Math.abs(h)
}

/**
 * Returns true if the first name is commonly female (for placeholder avatar).
 */
function isLikelyFemaleFirstname(fullName: string): boolean {
  const first = fullName.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  return first.length > 0 && FEMALE_FIRST_NAMES.has(first)
}

/**
 * Returns a placeholder avatar URL based on full name: girl-like names get a female
 * image, boy-like names get a male image. Deterministic per name (same name = same image).
 * Use when user has no avatar_url set.
 */
export function getPlaceholderAvatarUrl(fullName: string): string {
  const isFemale = isLikelyFemaleFirstname(fullName)
  const urls = isFemale ? FEMALE_PLACEHOLDER_URLS : MALE_PLACEHOLDER_URLS
  const index = hashString(fullName) % urls.length
  return urls[index]
}

/**
 * Returns avatar URL to use for a user: their avatar_url if set, otherwise
 * a placeholder by name (male/female).
 */
export function getUserAvatarUrl(avatarUrl: string | undefined | null, fullName: string): string {
  if (avatarUrl?.trim()) return avatarUrl.trim()
  return getPlaceholderAvatarUrl(fullName)
}
