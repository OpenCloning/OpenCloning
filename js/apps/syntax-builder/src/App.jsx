import React from 'react';
import { 
  Box,
  Container
} from '@mui/material';
import DesignForm from './components/DesignForm';
import { FormDataProvider, useFormData } from './context/FormDataContext';
import StartingPage from './components/StartingPage';
import OverhangsStep from './components/OverhangsStep';


export function AppContent() {
  const { parts } = useFormData();
  const [overhangsStep, setOverhangsStep] = React.useState(false);

  const renderContent = React.useCallback(() => {
    if (overhangsStep) {
      return <OverhangsStep setOverhangsStep={setOverhangsStep}/>;
    }
    else if (parts.length === 0) {
      return <StartingPage setOverhangsStep={setOverhangsStep}/>;
    }
    return <DesignForm />;
  }, [overhangsStep, parts]);

  return (
    <Box className="app-content">
      <Container >
        {renderContent()}
      </Container>
    </Box>
  );
}

function App() {
  return (
    <FormDataProvider>
      <AppContent />
    </FormDataProvider>
  );
}

export default App;
