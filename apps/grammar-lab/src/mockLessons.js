export const mockLessons = {
  'Article Usage': {
    1: {
      category: 'Article Usage',
      level: 1,
      title: 'Articles Level 1 - Foundations',
      questions: [
        {
          text: 'She bought ___ umbrella because it was raining heavily.',
          options: ['a', 'an', 'the', 'no article'],
          correctAnswer: 'an',
          explanation: 'Use "an" before singular countable nouns that begin with a vowel sound, like "umbrella."',
        },
        {
          text: 'I saw ___ moon clearly last night.',
          options: ['a', 'an', 'the', 'no article'],
          correctAnswer: 'the',
          explanation: 'Use "the" for unique things everyone can identify in context, such as "the moon."',
        },
        {
          text: 'My brother is ___ engineer at a robotics company.',
          options: ['a', 'an', 'the', 'no article'],
          correctAnswer: 'an',
          explanation: 'Use "an" before words that start with a vowel sound, and "engineer" starts with /e/.',
        },
        {
          text: 'They usually have ___ lunch at 1 p.m.',
          options: ['a', 'an', 'the', 'no article'],
          correctAnswer: 'no article',
          explanation: 'Meals are usually used without an article when speaking generally: have lunch, eat dinner, etc.',
        },
        {
          text: 'Can you open ___ window near the door?',
          options: ['a', 'an', 'the', 'no article'],
          correctAnswer: 'the',
          explanation: 'Use "the" because the listener can identify a specific window in the shared context.',
        },
      ],
    },
  },
}

export const CATEGORY_ALIASES = {
  articles: 'Article Usage',
  article: 'Article Usage',
  'article usage': 'Article Usage',
}
