import React from 'react';
import { Box, Typography, Paper, Container, Alert, Link } from '@mui/material';
import { useFormData, useLinkedPlasmids } from '../context/FormDataContext';
import useUploadData from './useUploadData';
import { ExistingSyntaxDialog } from '@opencloning/ui/components/assembler';



function SectionPaper({ title, children, sx }) {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        borderRadius: 2,
        mb: 3,
        ...sx,
      }}
    >
      <Typography variant="h6" component="h2" align="center" gutterBottom>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}


function StartingPage({ setOverhangsStep }) {
  const { addDefaultPart } = useFormData();
  const { uploadData } = useUploadData();
  const { setLinkedPlasmids } = useLinkedPlasmids();
  const fileInputRef = React.useRef(null);
  const [submissionError, setSubmissionError] = React.useState(null);
  const [existingSyntaxDialogOpen, setExistingSyntaxDialogOpen] = React.useState(false);
  const onFileChange = React.useCallback(async (event) => {
    try {
      const file = event.target.files[0];
      await uploadData(file);
    } catch (error) {
      setSubmissionError(error.message);
    } finally {
      fileInputRef.current.value = '';
    }
  }, [uploadData]);
  const onSelectOption = React.useCallback((id) => {
    if (id === 'overhangs') {
      setOverhangsStep(true);
    } else if (id === 'import') {
      fileInputRef.current.click();
    } else if (id === 'example') {
      setExistingSyntaxDialogOpen(true);
    } else {
      addDefaultPart();
    }
  }, [addDefaultPart, setOverhangsStep, fileInputRef, setExistingSyntaxDialogOpen]);

  const onSyntaxSelect = React.useCallback(async (syntax) => {
    try {
      const file = new File([JSON.stringify(syntax)], 'syntax.json', { type: 'application/json' });
      await uploadData(file);
      setLinkedPlasmids([]);
    } catch (error) {
      setSubmissionError(error.message);
    }
  }, [uploadData, setLinkedPlasmids]);

  const options = [
    {
      id: 'overhangs',
      title: 'Defining parts from overhangs',
      description: 'Start by entering overhangs to automatically generate parts',
    },
    {
      id: 'import',
      title: 'Importing parts or syntax from file',
      description: 'Import parts or syntax from a file (tsv or JSON)',
    },
    {
      id: 'direct',
      title: 'Defining parts directly',
      description: 'Manually define parts with all their properties',
    },
    {
      id: 'example',
      title: 'Loading an example',
      description: 'Load an example syntax (MoClo YTK)',
    },
  ];

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h2" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
          OpenCloning Syntax Builder
        </Typography>

        <SectionPaper title="Documentation">
          <Typography variant="body2" color="text.secondary" align="center">
            Need help getting started? Visit{' '}
            <Link
              href="https://docs.opencloning.org/syntax_builder"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
            >
              the documentation
            </Link>{' '}
            to see step-by-step instructions and examples.
          </Typography>
        </SectionPaper>

        <SectionPaper title="Create your syntax">
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Choose a method to begin creating your parts.
        </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {options.map((option) => (
              <Paper
                key={option.id}
                elevation={2}
                sx={{
                  p: 3,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    elevation: 4,
                    transform: 'translateY(-2px)',
                    bgcolor: 'action.hover',
                  },
                }}
                onClick={() => onSelectOption(option.id)}
              >
                {option.id === 'import' && (
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={onFileChange}
                    accept=".json,.tsv,.csv"
                  />
                )}
                <Typography variant="h6" gutterBottom>
                  {option.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {option.description}
                </Typography>
                {option.id === 'import' && submissionError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {submissionError}
                  </Alert>
                )}
              </Paper>
            ))}
          </Box>
        </SectionPaper>

        <SectionPaper title="Use and share your syntax" sx={{ mb: 0 }}>
          <Typography variant="body2" color="text.secondary" align="center">
            Once you&apos;re done defining your syntax, use the{' '}
            <strong>Download Syntax</strong> button at the top of the page to save a JSON file.
            <br />
            <br />
            You can use the syntax in <Link href="https://opencloning.org" target="_blank" underline="hover">OpenCloning</Link> to plan your assemblies.
            <br />
            <br />
            If
            you would like this syntax to be included for everyone, please{' '}
            <Link
              href="https://github.com/OpenCloning/syntaxes/issues"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
            >
              open an issue in GitHub
            </Link>{' '}
            and attach the file, or email{' '}
            <Link href="mailto:manuel.lera-ramirez@ucl.ac.uk" underline="hover">
              manuel.lera-ramirez@ucl.ac.uk
            </Link>
            .
          </Typography>
        </SectionPaper>
      </Box>
      {existingSyntaxDialogOpen && <ExistingSyntaxDialog onClose={() => setExistingSyntaxDialogOpen(false)} onSyntaxSelect={onSyntaxSelect} />}
    </Container>
  );
}

export default StartingPage;

