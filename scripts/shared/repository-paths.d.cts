export const repositoryRoot: string;
export function repositoryPath(...segments: string[]): string;
export function androidBuildOutput(environment?: {
  TRIPPRINT_BUILD_OUTPUT_DIR?: string;
}): string;
