/**
 * Content frameworks for guided content creation.
 * These are the 5 MVP frameworks matching the database schema.
 */

export interface FrameworkQuestion {
  key: string
  question: string
  type: 'text' | 'select'
  options?: string[]
}

export interface Framework {
  id: string
  name: string
  description: string
  output_type: 'caption' | 'carousel_script'
  questions: FrameworkQuestion[]
  prompt_template: string
  display_order: number
}

/**
 * The 5 MVP frameworks for fitness/wellness coaches.
 */
export const FRAMEWORKS: Framework[] = [
  {
    id: 'client_win',
    name: 'Client Win Story',
    description: 'Celebrate client success, build social proof',
    output_type: 'caption',
    questions: [
      { key: 'client_name', question: "Client's first name (or 'a client' if anonymous)", type: 'text' },
      { key: 'achievement', question: 'What did they achieve?', type: 'text' },
      { key: 'obstacle', question: 'What was their biggest obstacle?', type: 'text' },
      { key: 'timeframe', question: 'How long did it take?', type: 'text' },
      { key: 'lesson', question: 'One lesson others can learn from this', type: 'text' },
    ],
    prompt_template: `Write an Instagram caption celebrating a client transformation.

Client: {{client_name}}
Achievement: {{achievement}}
Obstacle they overcame: {{obstacle}}
Timeframe: {{timeframe}}
Key lesson: {{lesson}}

Structure:
- Hook (stop the scroll)
- The struggle (relatable)
- The transformation (specific)
- The lesson (actionable)
- CTA (engagement or DM)`,
    display_order: 1,
  },
  {
    id: 'educational_carousel',
    name: 'Educational Carousel',
    description: 'Teach something valuable, establish expertise',
    output_type: 'carousel_script',
    questions: [
      { key: 'topic', question: 'What topic do you want to teach?', type: 'text' },
      { key: 'audience', question: 'Who is this for?', type: 'text' },
      { key: 'mistake', question: "What's the common mistake people make with this?", type: 'text' },
      { key: 'unique_take', question: "What's your unique take or method?", type: 'text' },
    ],
    prompt_template: `Create an Instagram carousel script about {{topic}}.

Target audience: {{audience}}
Common mistake: {{mistake}}
Coach's unique approach: {{unique_take}}

Structure:
- Slide 1 (Cover): Bold claim or question that stops the scroll
- Slides 2-6: One key point per slide (short, scannable)
- Slide 7: Summary or "The truth is..."
- Slide 8: CTA (save, share, follow, DM)

Format each slide as:
**Slide N: [Title]**
[Body text - max 30 words per slide]`,
    display_order: 2,
  },
  {
    id: 'engagement_hook',
    name: 'Engagement Hook',
    description: 'Start conversations, boost algorithm',
    output_type: 'caption',
    questions: [
      { key: 'take_or_myth', question: "What's a spicy take or common myth in your niche?", type: 'text' },
      {
        key: 'engagement_type',
        question: 'What do you want people to comment?',
        type: 'select',
        options: ['Their opinion', 'Their experience', 'A or B choice'],
      },
    ],
    prompt_template: `Write a short Instagram engagement post.

Hot take or myth: {{take_or_myth}}
Desired engagement: {{engagement_type}}

Structure:
- Bold statement (challenge conventional wisdom)
- Brief explanation (1-2 sentences)
- Direct question to audience

Keep it under 100 words. End with a question that's easy to answer.`,
    display_order: 3,
  },
  {
    id: 'behind_the_scenes',
    name: 'Behind the Scenes',
    description: 'Build connection, show authenticity',
    output_type: 'caption',
    questions: [
      { key: 'activity', question: 'What are you doing today?', type: 'text' },
      { key: 'why_it_matters', question: 'Why does this matter to your audience?', type: 'text' },
      { key: 'insight', question: "What's one thing people don't realize about this?", type: 'text' },
    ],
    prompt_template: `Write a casual behind-the-scenes Instagram caption.

Activity: {{activity}}
Why it matters: {{why_it_matters}}
Insider insight: {{insight}}

Structure:
- Casual opener (like talking to a friend)
- What you're doing and why
- The insight or lesson
- Soft CTA (question or invitation to share theirs)

Keep it conversational and authentic. Not salesy.`,
    display_order: 4,
  },
  {
    id: 'myth_buster',
    name: 'Myth Buster',
    description: 'Establish authority, challenge misinformation',
    output_type: 'caption',
    questions: [
      { key: 'myth', question: 'What myth or misconception do you want to bust?', type: 'text' },
      { key: 'why_believed', question: 'Why do people believe this?', type: 'text' },
      { key: 'truth', question: "What's the truth?", type: 'text' },
      { key: 'action', question: 'What should people do instead?', type: 'text' },
    ],
    prompt_template: `Write an Instagram caption busting a fitness/wellness myth.

Myth: {{myth}}
Why people believe it: {{why_believed}}
The truth: {{truth}}
What to do instead: {{action}}

Structure:
- Hook: State the myth boldly ("Stop believing this...")
- Acknowledge why it's believable
- Drop the truth (with brief explanation)
- Actionable alternative
- CTA (save this, share with someone who needs it)

Be authoritative but not condescending.`,
    display_order: 5,
  },
]

/**
 * Get a framework by ID.
 */
export function getFrameworkById(id: string): Framework | undefined {
  return FRAMEWORKS.find(f => f.id === id)
}

/**
 * Get all active frameworks sorted by display order.
 */
export function getAllFrameworks(): Framework[] {
  return [...FRAMEWORKS].sort((a, b) => a.display_order - b.display_order)
}

/**
 * Validate that all required framework answers are provided.
 * @returns Array of missing question keys, empty if all provided
 */
export function validateFrameworkAnswers(
  frameworkId: string,
  answers: Record<string, string>
): string[] {
  const framework = getFrameworkById(frameworkId)
  if (!framework) {
    return ['framework_not_found']
  }

  const missing: string[] = []
  for (const question of framework.questions) {
    const answer = answers[question.key]
    if (!answer || answer.trim() === '') {
      missing.push(question.key)
    }
  }

  return missing
}

/**
 * Build a prompt from framework template and answers.
 * Interpolates {{key}} placeholders with escaped answer values.
 */
export function buildFrameworkPrompt(
  frameworkId: string,
  answers: Record<string, string>
): string | null {
  const framework = getFrameworkById(frameworkId)
  if (!framework) {
    return null
  }

  let prompt = framework.prompt_template

  // Replace all {{key}} placeholders with answers
  for (const [key, value] of Object.entries(answers)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    prompt = prompt.replace(placeholder, escapeForPrompt(value))
  }

  return prompt
}

/**
 * Escape user input for safe inclusion in prompts.
 */
function escapeForPrompt(value: string): string {
  // Remove any XML-like tags that could confuse the model
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{\{/g, '{ {')  // Prevent nested placeholder injection
    .replace(/\}\}/g, '} }')
}

/**
 * Framework IDs as a type for validation.
 */
export type FrameworkId = typeof FRAMEWORKS[number]['id']

/**
 * Get framework IDs as an array (useful for Zod validation).
 */
export function getFrameworkIds(): string[] {
  return FRAMEWORKS.map(f => f.id)
}
