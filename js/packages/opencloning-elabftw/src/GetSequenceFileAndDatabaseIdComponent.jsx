import React from 'react';
import ELabFTWCategorySelect from './ELabFTWCategorySelect';
import ELabFTWResourceSelect from './ELabFTWResourceSelect';
import ELabFTWFileSelect from './ELabFTWFileSelect';
import { getFileFromELabFTW } from './utils';
import RetryAlert from '@opencloning/ui/components/form/RetryAlert';

function GetSequenceFileAndDatabaseIdComponent({ setFile, setDatabaseId }) {
  const [category, setCategory] = React.useState(null);
  const [resource, setResource] = React.useState(null);
  const [fileInfo, setFileInfo] = React.useState(null);
  const [fileLoadError, setFileLoadError] = React.useState('');
  const [retry, setRetry] = React.useState(0);

  // Reset if category changes
  React.useEffect(() => {
    setResource(null);
    setFileInfo(null);
    setFile(null);
    setDatabaseId(null);
  }, [category]);

  // Reset if resource changes
  React.useEffect(() => {
    setFileInfo(null);
    setFile(null);
    setDatabaseId(null);
  }, [resource]);

  React.useEffect(() => {
    setFile(null);
    setDatabaseId(null);
  }, [fileInfo]);

  React.useEffect(() => {
    const loadFile = async () => {
      if (!resource || !fileInfo) return;
      try {
        const file = await getFileFromELabFTW(resource.id, fileInfo);
        setFile(file);
        setDatabaseId(resource.id);
        setFileLoadError('');
      } catch (error) {
        setFileLoadError('Error loading file');
        console.error('Error loading file', error);
      }
    };

    loadFile();
  }, [resource, fileInfo, retry]);

  return (
    <>
      <ELabFTWCategorySelect mode="resource_type" fullWidth setCategory={setCategory} className="elabftw-category-select" />
      {category && <ELabFTWResourceSelect fullWidth setResource={setResource} categoryId={category.id} className="elabftw-resource-select" />}
      {resource && <ELabFTWFileSelect fullWidth setFileInfo={setFileInfo} itemId={resource.id} className="elabftw-file-select" />}
      {fileLoadError && <RetryAlert severity="error" onRetry={() => setRetry((prev) => prev + 1)}>{fileLoadError}</RetryAlert>}
    </>
  );
}

export default GetSequenceFileAndDatabaseIdComponent;
