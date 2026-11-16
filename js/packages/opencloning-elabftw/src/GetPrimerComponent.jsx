import React, { useCallback } from 'react';
import ELabFTWCategorySelect from './ELabFTWCategorySelect';
import ELabFTWResourceSelect from './ELabFTWResourceSelect';
import { getPrimerSequenceFromExtraFields } from './utils';

function GetPrimerComponent({ primer, setPrimer, setError }) {
  const [category, setCategory] = React.useState(null);

  React.useEffect(() => {
    if (category === null) {
      setPrimer(null);
    }
  }, [category]);

  const handleResourceSelect = useCallback(async (resource) => {
    if (resource === null) {
      setPrimer(null);
      setError('');
      return;
    }
    let sequence;
    try {
      sequence = getPrimerSequenceFromExtraFields(JSON.parse(resource.metadata).extra_fields);
      if (!sequence) {
        setError('No sequence found in metadata');
        setPrimer(null);
        return;
      }
    } catch (e) {
      setError('No sequence found in metadata');
      setPrimer(null);
      return;
    }

    setPrimer({ name: resource.title, sequence, database_id: resource.id });
  }, [setPrimer, setError]);

  return (
    <>
      <ELabFTWCategorySelect
        mode="resource_type"
        setCategory={setCategory}
        fullWidth
      />

      {category && (
      <ELabFTWResourceSelect
        setResource={handleResourceSelect}
        categoryId={category.id}
        fullWidth
      />
      )}
    </>
  );
}

export default GetPrimerComponent;
