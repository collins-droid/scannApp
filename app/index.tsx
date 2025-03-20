import { Redirect } from 'expo-router';

/**
 * Root index that redirects to the scanner tab
 */
export default function Index() {
  return <Redirect href="/(tabs)/scanner" />;
} 