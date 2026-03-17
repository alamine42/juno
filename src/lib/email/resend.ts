import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendMagicLink(email: string, magicLink: string) {
  const { data, error } = await resend.emails.send({
    from: 'Juno <noreply@yourdomain.com>', // Update with your domain
    to: email,
    subject: 'Sign in to Juno',
    html: `
      <h1>Welcome to Juno!</h1>
      <p>Click the link below to sign in:</p>
      <a href="${magicLink}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Sign In
      </a>
      <p style="color: #666; margin-top: 24px;">
        This link expires in 1 hour.
      </p>
    `,
  })

  if (error) {
    console.error('Failed to send magic link:', error)
    throw error
  }

  return data
}

export async function sendPostingReminder(
  email: string,
  coachName: string,
  contentPreview: string,
  contentId: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const { data, error } = await resend.emails.send({
    from: 'Juno <noreply@yourdomain.com>', // Update with your domain
    to: email,
    subject: `Time to post: ${contentPreview.slice(0, 50)}...`,
    html: `
      <p>Hey ${coachName || 'there'},</p>
      <p>Your scheduled post is ready to go live!</p>

      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; white-space: pre-wrap;">${contentPreview}</p>
      </div>

      <p>
        <a href="${appUrl}/content/${contentId}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 8px;">
          Copy to Clipboard
        </a>
        <a href="https://instagram.com" target="_blank" style="display: inline-block; background: #e11d48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Open Instagram
        </a>
      </p>

      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />

      <p style="color: #666; font-size: 14px;">
        Juno - AI Chief of Staff for Coaches
      </p>
    `,
  })

  if (error) {
    console.error('Failed to send posting reminder:', error)
    throw error
  }

  return data
}
