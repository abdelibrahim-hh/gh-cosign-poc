export type FunctionComponent = React.ReactElement | null;

type HeroIconSVGProps = React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> &
	React.RefAttributes<SVGSVGElement>;
type IconProps = HeroIconSVGProps & {
	title?: string;
	titleId?: string;
};
export type Heroicon = React.FC<IconProps>;

export interface AppConfig {
  apiBaseUrl: string;
  environment: "development" | "staging" | "production";
  features: FeatureFlags;
}

export interface FeatureFlags {
  darkMode: boolean;
  analytics: boolean;
  betaFeatures: boolean;
}

export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };
