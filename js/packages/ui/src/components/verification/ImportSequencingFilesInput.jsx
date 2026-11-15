import React from 'react'
import { sequencingFileExtensions } from '@opencloning/utils/sequencingFileExtensions';
function ImportSequencingFilesInput({ onFileChange, fileInputRef }) {

  return (
    <input
      type="file"
      accept={sequencingFileExtensions.map((ext) => `.${ext}`).join(', ')}
      multiple
      onChange={(event) => {onFileChange(Array.from(event.target.files)); fileInputRef.current.value = '';}}
      hidden
      ref={fileInputRef}
    />
  )
}

export default ImportSequencingFilesInput
