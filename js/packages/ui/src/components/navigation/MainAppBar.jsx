import React from 'react';
import { AppBar, Box, Toolbar, Container, Button, Tooltip, IconButton, Menu, MenuItem } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import './MainAppBar.css';
import { useDispatch } from 'react-redux';
import ButtonWithMenu from './ButtonWithMenu';
import { downloadCloningStrategyAsSvg, formatTemplate } from '@opencloning/utils/readNwrite';
import SelectExampleDialog from './SelectExampleDialog';
import SelectTemplateDialog from './SelectTemplateDialog';
import FeedbackDialog from './FeedbackDialog';
import { cloningActions } from '@opencloning/store/cloning';
import VersionDialog from './VersionDialog';
import useCloningAlerts from '../../hooks/useCloningAlerts';
import DownloadCloningStrategyDialog from '../DownloadCloningStrategyDialog';
import LoadCloningHistoryWrapper from '../LoadCloningHistoryWrapper';
import useCloningHistoryLoader from '../../hooks/useCloningHistoryLoader';
import GithubCornerRight from './GithubCornerRight';
import { getExternalHttpClient } from '@opencloning/utils/httpClients';

// External urls (not the backend): no auth token, only whitelisted urls
const httpClient = getExternalHttpClient();

const { setCurrentTab } = cloningActions;

function MainAppBar() {
  const [openExampleDialog, setOpenExampleDialog] = React.useState(false);
  const [openTemplateDialog, setOpenTemplateDialog] = React.useState(false);
  const [openFeedbackDialog, setOpenFeedbackDialog] = React.useState(false);
  const [openCloningStrategyDialog, setOpenCloningStrategyDialog] = React.useState(false);
  const [fileList, setFileList] = React.useState([]);
  const [openVersionDialog, setOpenVersionDialog] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const openMenu = Boolean(anchorEl);

  const dispatch = useDispatch();
  const { addAlert } = useCloningAlerts();
  const { applyCloningStrategy, loadHistoryFromFile } = useCloningHistoryLoader();

  // Hidden input field, used to load files.
  const fileInputRef = React.useRef(null);

  const fileMenu = [
    { display: 'Save cloning history to file', onClick: () => setOpenCloningStrategyDialog(true) },
    { display: 'Load cloning history from file', onClick: () => { fileInputRef.current.click(); fileInputRef.current.value = ''; } },
    { display: 'Print cloning history to svg',
      onClick: async () => {
        await dispatch(setCurrentTab(0));
        downloadCloningStrategyAsSvg('history.svg');
      } },
  ];


  const handleCloseDialog = async (url, isTemplate) => {
    setOpenExampleDialog(false);
    setOpenTemplateDialog(false);
    if (url) {
      const fileName = url.split('/').pop();
      let file;
      if (url.endsWith('.zip')) {
        const { data: blob } = await httpClient.get(url, { responseType: 'blob' });
        file = new File([blob], fileName);
      } else {
        const { data: jsonData } = await httpClient.get(url);
        file = new File([JSON.stringify(jsonData)], fileName);
      }
      const prepared = await loadHistoryFromFile(file, {
        onError: (message) => addAlert({ message, severity: 'error' }),
      });
      if (!prepared) {
        return;
      }
      let strategy = prepared.cloningStrategy;
      if (isTemplate) {
        strategy = formatTemplate(strategy, url);
      }
      await applyCloningStrategy(strategy, {
        verificationFiles: prepared.verificationFiles,
        mode: 'replace',
      });
      dispatch(setCurrentTab(0));
    }
  };

  // TODO: turn these into <a> elements.
  const helpMenu = [
    { display: 'Newsletter', onClick: () => window.open('https://eepurl.com/h9-n71') },
    { display: 'About the project', onClick: () => window.open('https://github.com/OpenCloning/OpenCloning') },
    { display: 'GitHub repository', onClick: () => window.open('https://github.com/OpenCloning/OpenCloning_frontend') },
    { display: 'Demo videos', onClick: () => window.open('https://www.youtube.com/watch?v=n0hedzvpW88&list=PLpv3x-ensLZkJToD2E6ejefADmHcUPYSJ&index=1') },
    { display: 'App version', onClick: () => setOpenVersionDialog(true) },
  ];

  const onFileChange = async (event) => {
    const { files } = event.target;
    if (files[0].name.endsWith('.json') || files[0].name.endsWith('.zip')) {
      setFileList([...files]);
    } else {
      setFileList([]);
      addAlert({ message: 'Only JSON and zip files are accepted', severity: 'error' });
    }
    event.target.value = '';
  };

  // If you want to do something on page load, you can do it here.
  // React.useEffect(() => {
  //   const fetchExample = async () => {
  //     dispatch(setCurrentTab(3));
  //     // Wait for the primer designer to be rendered
  //     setTimeout(() => {
  //       // Click on button that says Open primer designer
  //       const primerDesignerButton = document.querySelector('.main-sequence-editor button');
  //       if (primerDesignerButton) {
  //         primerDesignerButton.click();
  //       }
  //     }, 300);
  //   };
  //   fetchExample();
  // }, []);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <AppBar position="static" className="app-bar">
      <div className="app-name">OpenCloning</div>
      <Tooltip title="View source code on GitHub" placement="left" componentsProps={{ tooltip: { sx: { fontSize: '1rem' } } }}>
        <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
          <Button
            className="github-corner"
            onClick={() => window.open('https://github.com/OpenCloning/OpenCloning')}
            aria-label="GitHub repository"
          >
            <GithubCornerRight />
          </Button>
        </Box>
      </Tooltip>
      <Container className="app-bar-container">
        <Toolbar variant="dense" sx={{ minHeight: 50, justifyContent: 'center' }}>
          {/* Mobile menu button and dropdown */}
          <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={handleMenuOpen}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={openMenu}
              onClose={handleMenuClose}
              sx={{ display: { xs: 'block', md: 'none' } }}
            >
              {/* File menu items */}
              {fileMenu.map((item) => (
                <MenuItem key={item.display} onClick={() => { item.onClick(); handleMenuClose(); }}>
                  {item.display}
                </MenuItem>
              ))}
              {/* Help menu items */}
              {helpMenu.map((item) => (
                <MenuItem key={item.display} onClick={() => { item.onClick(); handleMenuClose(); }}>
                  {item.display}
                </MenuItem>
              ))}
              <MenuItem><a style={{ color: 'inherit', textDecoration: 'none' }} target="_blank" href="https://docs.opencloning.org">Documentation</a></MenuItem>
              <MenuItem onClick={() => { setOpenExampleDialog(true); handleMenuClose(); }}>Examples</MenuItem>
              <MenuItem onClick={() => { setOpenTemplateDialog(true); handleMenuClose(); }}>Templates</MenuItem>
              <MenuItem onClick={() => { setOpenFeedbackDialog(true); handleMenuClose(); }}>Feedback</MenuItem>
            </Menu>
          </Box>

          {/* Desktop buttons - hidden on mobile */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            <ButtonWithMenu menuItems={fileMenu}>File</ButtonWithMenu>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={onFileChange} accept=".json,.zip" />
            {fileList && <LoadCloningHistoryWrapper fileList={fileList} clearFiles={() => setFileList([])} />}
            <ButtonWithMenu menuItems={helpMenu}>About</ButtonWithMenu>
            <Button><a style={{ color: 'inherit', textDecoration: 'none' }} target="_blank" href="https://docs.opencloning.org">Documentation</a></Button>
            <Button onClick={() => setOpenExampleDialog(true)}>Examples</Button>
            <Button onClick={() => setOpenTemplateDialog(true)}>Templates</Button>
            <Button onClick={() => setOpenFeedbackDialog(true)}>Feedback</Button>
          </Box>

        </Toolbar>
      </Container>
      <SelectExampleDialog onClose={handleCloseDialog} open={openExampleDialog} />
      {/* Conditional, since we only want to make request to github if templates want to be used */}
      {openTemplateDialog && <SelectTemplateDialog onClose={handleCloseDialog} open={openTemplateDialog} />}
      <FeedbackDialog open={openFeedbackDialog} setOpen={setOpenFeedbackDialog} />
      {openCloningStrategyDialog && <DownloadCloningStrategyDialog open={openCloningStrategyDialog} setOpen={setOpenCloningStrategyDialog} />}
      <VersionDialog open={openVersionDialog} setOpen={setOpenVersionDialog} />
    </AppBar>
  );
}

export default MainAppBar;
