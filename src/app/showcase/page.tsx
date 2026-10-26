import { notFound } from 'next/navigation'
import { ProductScreen, SCREEN_NAMES, type ScreenName } from '@/components/marketing/product-screens'

export const metadata = {
  title: 'Product screens',
  robots: { index: false, follow: false },
}

/**
 * Development-only route that renders one marketing product screen at a time
 * (?screen=dashboard). It is used to capture the images in public/marketing.
 * It is never served in production.
 */
export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { screen } = await searchParams
  const name = SCREEN_NAMES.find((n) => n === screen) as ScreenName | undefined
  if (!name) {
    return (
      <main className="min-h-screen bg-neutral-950 p-8 text-neutral-100">
        <h1 className="text-xl font-semibold">Product screens</h1>
        <ul className="mt-4 list-disc space-y-1 pl-6">
          {SCREEN_NAMES.map((n) => (
            <li key={n}>
              <a className="underline" href={`/showcase?screen=${n}`}>{n}</a>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden" data-screen={name}>
      <ProductScreen name={name} />
    </div>
  )
}
