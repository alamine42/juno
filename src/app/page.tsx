import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Juno</h1>
        <p className="text-xl text-gray-600 mb-8">
          AI Chief of Staff for Coaches
        </p>
        <div className="space-x-4">
          <Link
            href="/auth/login"
            className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  )
}
