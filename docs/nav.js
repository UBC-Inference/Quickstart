const NAV = [
  {
    title: "Introduction",
    links: [
      { title: "Introduction", href: "/" },
    ],
  },
  {
    title: "Inference",
    links: [
      { title: "Inference Overview", href: "/inference" },
      { title: "Reading List", href: "/inference-reading-list" },
    ],
  },
  {
    title: "Projects",
    links: [
      { title: "Serverless Platform", href: "/serverless-platform/" },
    ],
  },
];

const PAGES = {
  "/": { file: "content/index.md", title: "Introduction" },
  "/inference": { file: "content/inference.md", title: "Inference Overview" },
  "/inference-reading-list": { file: "content/inference-reading-list.md", title: "Reading List" },
  "/serverless-platform/": { file: "content/serverless-platform/index.md", title: "Serverless Platform" },
};
