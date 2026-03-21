import { redirect } from 'next/navigation'

export default async function CrewIndexPage({ params }: { params: Promise<{ crewId: string }> }) {
  const { crewId } = await params
  redirect(`/crew/${crewId}/tonight`)
}
