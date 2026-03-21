import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 text-green-600 text-2xl font-bold">
            J
          </span>
        </div>
        <h1 className="text-2xl font-bold mb-3">Juno</h1>
        <p className="text-lg text-gray-600 mb-8">
          Create Instagram content that sounds like you
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center min-h-[44px] bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
        >
          Get Started
        </Link>
        <p className="text-sm text-gray-500 mt-8">
          Trusted by fitness and wellness coaches
        </p>
      </div>
    </main>
  )
}
