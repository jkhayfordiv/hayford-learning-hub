export const LESSONS = {
  'Article Usage': {
    1: {
      category: 'Article Usage',
      level: 1,
      title: 'Article Usage: Level 1 Foundations',
      questions: [
        {
          id: 1,
          text: 'I bought ___ new car yesterday for my commute to campus.',
          options: ['a', 'an', 'the', 'no article'],
          correct: 'a',
          explanation: "Use 'a' when introducing a singular countable noun for the first time.",
        },
        {
          id: 2,
          text: 'The researchers interviewed ___ expert from the Ministry of Education.',
          options: ['a', 'an', 'the', 'no article'],
          correct: 'an',
          explanation: "Use 'an' before singular countable nouns that begin with a vowel sound, such as 'expert'.",
        },
        {
          id: 3,
          text: 'After reviewing the data, the team published ___ report to summarize its findings.',
          options: ['a', 'an', 'the', 'no article'],
          correct: 'a',
          explanation: "Use 'a' because this is a non-specific singular report being introduced for the first time.",
        },
        {
          id: 4,
          text: 'Please email me ___ article you mentioned in yesterday\'s seminar.',
          options: ['a', 'an', 'the', 'no article'],
          correct: 'the',
          explanation: "Use 'the' because both speakers can identify the specific article from shared context.",
        },
        {
          id: 5,
          text: 'Most graduate students need to develop ___ critical thinking before writing a dissertation.',
          options: ['a', 'an', 'the', 'no article'],
          correct: 'no article',
          explanation: "No article is used with uncountable nouns in general meaning, such as 'critical thinking'.",
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
