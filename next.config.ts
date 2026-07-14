import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Multiple lockfiles up the directory tree (e.g. one in the home folder)
  // were making Turbopack infer the workspace root as something far above
  // this project, which made it scan/watch way more of the filesystem than
  // necessary — pinning it here stops that.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
