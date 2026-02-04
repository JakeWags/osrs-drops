import { MantineProvider } from '@mantine/core';
import { Shell } from './components/Layout/Shell';
import { Dashboard } from './pages/Dashboard';

function App() {
  return (
    <MantineProvider theme={{ primaryColor: 'blue' }}>
      <Shell>
        <Dashboard />
      </Shell>
    </MantineProvider>
  );
}

export default App;