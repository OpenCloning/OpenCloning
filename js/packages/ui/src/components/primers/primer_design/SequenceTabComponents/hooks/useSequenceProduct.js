import React from 'react';
import { useStore } from 'react-redux';
import designTypeStrategies from '../designTypeStrategies';

export default function useSequenceProduct({
  rois, spacers, spacersAreValid, fragmentOrientations, circularAssembly,
  designType, primerDesignSettings, sequenceIds, submissionPreventedMessage,
}) {
  const [sequenceProduct, setSequenceProduct] = React.useState(null);
  const timeoutRef = React.useRef();
  const store = useStore();

  React.useEffect(() => {
    clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      let newSequenceProduct = null;
      if (submissionPreventedMessage === '') {
        const { teselaJsonCache } = store.getState().cloning;
        const sequences = sequenceIds.map((id) => teselaJsonCache[id]);
        const strategy = designTypeStrategies[designType];
        if (strategy) {
          newSequenceProduct = strategy.computeProduct({
            sequences, rois, fragmentOrientations, spacers, circularAssembly, primerDesignSettings,
          });
        }
      }
      setSequenceProduct({ ...newSequenceProduct, id: 'opencloning_primer_design_product' });
    }, 300);

    return () => clearTimeout(timeoutRef.current);
  }, [rois, spacersAreValid, fragmentOrientations, circularAssembly, designType, spacers, primerDesignSettings, sequenceIds, store, submissionPreventedMessage]);

  return sequenceProduct;
}
