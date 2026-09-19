export type TestResult = 'PASS' | 'FAIL' | 'PENDING'

export interface BioTestEntry {
  id?: number
  s_no?: number
  date: string
  train_no: string
  coach_no: string
  code: string
  bio_tank_no: string
  ph: number | null
  cod: number | null
  fcfc: number | null
  result: TestResult
  second_test_date: string | null
  second_test_result: TestResult | null
  created_at?: string
  depot?: string
}

export interface FormEntry {
  date: string
  train_no: string
  coach_no: string
  code: string
  bio_tank_no: string
  ph: string
  cod: string
  fcfc: string
  second_test_date: string
  second_test_result: string
}

// Limits as per spec
export const LIMITS = {
  ph: { min: 6, max: 9 },
  cod: { max: 1800 },
  fcfc: { max: 10000000 },
} as const

export function calculateResult(
  ph: number | null,
  cod: number | null,
  fcfc: number | null
): TestResult {
  if (ph === null || cod === null || fcfc === null) return 'PENDING'
  const phOk = ph >= LIMITS.ph.min && ph <= LIMITS.ph.max
  const codOk = cod < LIMITS.cod.max
  const fcfcOk = fcfc < LIMITS.fcfc.max
  return phOk && codOk && fcfcOk ? 'PASS' : 'FAIL'
}
