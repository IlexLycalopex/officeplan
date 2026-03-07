import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isToday, isTomorrow, isThisWeek } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isThisWeek(d)) return format(d, 'EEEE')
  return format(d, 'd MMM yyyy')
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd MMM')
}

export function isoDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getWeekDates(weekOffset = 0): Date[] {
  const today = new Date()
  const monday = new Date(today)
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(today.getDate() + diff + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export function daysUntil(dateStr: string): number {
  const target = parseISO(dateStr)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
