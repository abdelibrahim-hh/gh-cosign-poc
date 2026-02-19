import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";
import type { FunctionComponent } from "./common/types";
import type { TanstackRouter } from "./main";
import { TanStackRouterDevelopmentTools } from "./components/utils/development-tools/TanStackRouterDevelopmentTools";
import { isFeatureEnabled } from "./common/utils";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

type AppProps = { router: TanstackRouter };

const App = ({ router }: AppProps): FunctionComponent => {
  const showDevTools = isFeatureEnabled("betaFeatures");

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {showDevTools && (
        <>
          <TanStackRouterDevelopmentTools
            initialIsOpen={false}
            position="bottom-left"
            router={router}
          />
          <ReactQueryDevtools initialIsOpen={false} position="bottom" />
        </>
      )}
    </QueryClientProvider>
  );
};

export default App;
