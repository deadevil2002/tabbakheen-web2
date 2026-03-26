export const redirectSystemPath = ({ path, initial }: { path: string; initial: boolean }) => {
  if (initial) {
    return "/";
  }
  return path;
};
