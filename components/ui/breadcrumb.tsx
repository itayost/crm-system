'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronLeft className="h-4 w-4 text-gray-400" />}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-gray-800 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-800 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}
