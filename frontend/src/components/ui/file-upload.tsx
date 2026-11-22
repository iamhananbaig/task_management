import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

interface FileUploadProps {
  id: string
  label?: string
  description?: string
  multiple?: boolean
  accept?: string
  onFilesSelected: (files: FileList) => void
  disabled?: boolean
  className?: string
}

export function FileUpload({
  id,
  label,
  description,
  multiple = false,
  accept,
  onFilesSelected,
  disabled,
  className,
}: FileUploadProps) {
  return (
    <Field className={className}>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <Input
        id={id}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(e.target.files)
          }
        }}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}
