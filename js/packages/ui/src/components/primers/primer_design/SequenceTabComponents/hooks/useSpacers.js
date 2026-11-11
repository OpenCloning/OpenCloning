import React from 'react';
import { stringIsNotDNA } from '@opencloning/store/cloning_utils';

export default function useSpacers({ initialLength }) {
  const [spacers, setSpacers] = React.useState(Array(initialLength).fill(''));

  const spacersAreValid = React.useMemo(
    () => spacers.every((spacer) => !stringIsNotDNA(spacer)),
    [spacers],
  );

  return { spacers, setSpacers, spacersAreValid };
}
