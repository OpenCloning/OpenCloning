import React, { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Tabs } from '@mui/material';
import DescriptionEditor from './DescriptionEditor';
import PrimerList from './primers/PrimerList';
import SettingsTab from './settings/SettingsTab';
import { cloningActions } from '@opencloning/store/cloning';
import TabPanel from './navigation/TabPanel';
import CustomTab from './navigation/CustomTab';
import DataModelDisplayer from './DataModelDisplayer';
import CloningHistory from './CloningHistory';
import SequenceTab from './SequenceTab';
import AppAlerts from './AppAlerts';
import Assembler from './assembler/Assembler';
import { useConfig } from '../hooks/useConfig';
import useCloningAlerts from '../hooks/useCloningAlerts';

const { setCurrentTab } = cloningActions;

function OpenCloning() {
  const dispatch = useDispatch();
  const currentTab = useSelector((state) => state.cloning.currentTab);
  const tabPanelsRef = useRef(null);
  const [smallDevice, setSmallDevice] = useState(window.innerWidth < 600);
  const { showAppBar: hasAppBar, enableAssembler } = useConfig();
  const { removeAlert } = useCloningAlerts();

  React.useEffect(() => {
    const handleResize = () => {
      setSmallDevice(window.innerWidth < 600);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const changeTab = (event, newValue) => {
    dispatch(setCurrentTab(newValue));
    if (tabPanelsRef.current) {
      tabPanelsRef.current.scrollTo({
        top: 0,
        behavior: 'instant',
      });
    }
  };

  return (
    <div className="app-container" style={{ height: hasAppBar ? 'calc(100vh - 114px - 10px)' : '100vh' }}>
      <Tabs
        variant={smallDevice ? 'scrollable' : 'standard'}
        scrollButtons={smallDevice ? 'auto' : false}
        allowScrollButtonsMobile
        centered={!smallDevice}
        value={currentTab}
        onChange={changeTab}
        sx={{ pb: 2, pt: 1 }}
        id="opencloning-app-tabs"
      >
        <CustomTab label="Cloning" index={0} />
        <CustomTab label="Primers" index={1} />
        <CustomTab label="Description" index={2} />
        <CustomTab label="Sequence" index={3} />
        <CustomTab label="Data model" index={4} />
        <CustomTab label="Settings" index={5} />
        {enableAssembler && <CustomTab label="Assembler" index={6} />}
      </Tabs>
      <div className="tab-panels-container" ref={tabPanelsRef}>
        <AppAlerts reducerName="cloning" removeAlert={removeAlert} />
        <TabPanel index={1} value={currentTab} className="primer-tab-pannel">
          <div className="primer-list-container">
            <PrimerList />
          </div>
        </TabPanel>
        <TabPanel index={2} value={currentTab} className="description-tab-pannel">
          <div className="description-editor">
            <DescriptionEditor />
          </div>
        </TabPanel>
        {/* For some reason, putting this here is required for primer.color to work */}
        <TabPanel index={3} value={currentTab} className="main-editor-tab-pannel">
          <div className="main-sequence-editor">
            <SequenceTab />
          </div>
        </TabPanel>
        <TabPanel index={0} value={currentTab} className="cloning-tab-pannel">
          <div className="open-cloning">
            <CloningHistory />
          </div>
        </TabPanel>
        <TabPanel index={4} value={currentTab} className="data-model-tab-pannel">
          <DataModelDisplayer />
        </TabPanel>
        <TabPanel index={5} value={currentTab} className="settings-tab-pannel">
          <SettingsTab />
        </TabPanel>
        {enableAssembler && <TabPanel index={6} value={currentTab} className="assembler-tab-pannel">
          <Assembler />
        </TabPanel>}
      </div>
    </div>
  );
}

export default OpenCloning;
