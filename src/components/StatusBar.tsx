interface Props {
  totalPages: number
  diagnosticsCount: number
  lastCompileMs: number | null
}

export function StatusBar({ totalPages, diagnosticsCount, lastCompileMs }: Props) {
  return (
    <div className="flex gap-4 p-1 px-3 border-t bg-neutral-900 text-neutral-400 text-xs">
      <span>Pages: {totalPages}</span>
      <span>Problems: {diagnosticsCount}</span>
      <span>{lastCompileMs != null ? `Compile: ${lastCompileMs}ms` : ''}</span>
    </div>
  )
}
