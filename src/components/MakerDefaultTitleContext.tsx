'use client'

import { createContext, useContext } from 'react'

const MakerDefaultTitleContext = createContext('')

export function MakerDefaultTitleProvider({ title, children }: { title: string; children: React.ReactNode }) {
  return <MakerDefaultTitleContext.Provider value={title}>{children}</MakerDefaultTitleContext.Provider>
}

export function useMakerDefaultTitle() {
  return useContext(MakerDefaultTitleContext)
}
