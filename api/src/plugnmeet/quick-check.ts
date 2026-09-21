import { randomUUID } from 'node:crypto'
import { supabase } from '../lib/supabase'
import { plugNmeet } from './client'

export type QuickCheckQuestion = {
  question: string
  options: [string, string, string, string]
  correct_index: 0 | 1 | 2 | 3
}

function normaliseQuestions(value: unknown): QuickCheckQuestion[] {
  if (!Array.isArray(value) || value.length !== 3) throw new Error('The model did not return exactly three questions')
  return value.map((item: any) => {
    if (!item || typeof item.question !== 'string' || !Array.isArray(item.options) || item.options.length !== 4) throw new Error('Invalid Quick Check question')
    const correct = Number(item.correct_index)
    if (!Number.isInteger(correct) || correct < 0 || correct > 3) throw new Error('Invalid Quick Check answer')
    return { question: item.question.trim().slice(0, 500), options: item.options.map((option: unknown) => String(option).trim().slice(0, 240)) as QuickCheckQuestion['options'], correct_index: correct as QuickCheckQuestion['correct_index'] }
  })
}

export async function generateAudioQuickCheck(transcript: string): Promise<QuickCheckQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `Create exactly three multiple-choice questions from the tutor transcript below. Use only facts explicitly stated in the transcript. Return JSON only in the shape {"questions":[{"question":"...","options":["...","...","...","..."],"correct_index":0}]}.\n\nTRANSCRIPT:\n${transcript}` }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  })
  if (!response.ok) throw new Error(`Quick Check model failed (${response.status})`)
  const json: any = await response.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') throw new Error('Quick Check model returned no content')
  const parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/, ''))
  return normaliseQuestions(parsed.questions)
}

export async function generateAudioRecap(transcript: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `Write a concise, factual class recap using only this tutor transcript. Include a short overview, key points, and next steps if explicitly stated. Do not invent information. Use plain text with short headings.\n\nTRANSCRIPT:\n${transcript}` }] }], generationConfig: { temperature: 0.2 } }),
  })
  if (!response.ok) throw new Error(`Recap model failed (${response.status})`)
  const json: any = await response.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string' || text.trim().length < 20) throw new Error('Recap model returned no usable content')
  return text.trim().slice(0, 12_000)
}

export function questionOptions(questions: QuickCheckQuestion[]) {
  return questions.map((question, questionIndex) => ({
    question: question.question,
    options: question.options.map((text, index) => ({ id: index + 1, text, is_correct: index === question.correct_index })),
    questionIndex,
  }))
}

export async function publishAudioQuickCheck(input: { classId: string; candidateId: string; tutorId: string; roomId: string; questions: QuickCheckQuestion[] }) {
  const pollIds: string[] = []
  for (const question of questionOptions(input.questions)) {
    const result = await plugNmeet.createPoll({ room_id: input.roomId, question: question.question, options: question.options, is_quiz: true, is_anonymous: false, duration: 120 })
    if (result.poll_id) pollIds.push(String(result.poll_id))
  }
  await (supabase as any).from('live_class_quick_checks').update({ status: 'published', provider_poll_id: pollIds.join(','), published_at: new Date().toISOString() }).eq('candidate_id', input.candidateId).eq('live_class_id', input.classId).eq('tutor_id', input.tutorId)
  return pollIds
}

export function newCandidateId() { return randomUUID() }
