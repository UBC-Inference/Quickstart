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
        title: "ML without prerequisites",
        links: [
            { title: "Reading List", href: "/ml-from-scratch-reading-list" },
        ],
    },
    {
        title: "[Project] Serverless Platform",
        links: [
            { title: "Serverless Platform", href: "/serverless-platform" },
            { title: "Control Plane", href: "/serverless-platform/distributed-control-plane" },
            { title: "System Primitives", href: "/serverless-platform/artifact-distribution" },
            { title: "Reading List", href: "/serverless-platform/serverless-reading-list" },
        ],
    },

];

const PAGES = {
    "/": { file: "content/index.md", title: "Introduction" },
    "/inference": { file: "content/inference.md", title: "Inference Overview" },
    "/inference-reading-list": { file: "content/inference-reading-list.md", title: "Reading List" },
    "/serverless-platform": { file: "content/serverless-platform/index.md", title: "Serverless Platform" },
    "/serverless-platform/distributed-control-plane": { file: "content/serverless-platform/distributed-control-plane.md", title: "Distributed Control Plane" },
    "/serverless-platform/artifact-distribution": { file: "content/serverless-platform/artifact-distribution.md", title: "System-Level Primitives" },
    "/serverless-platform/serverless-reading-list": { file: "content/serverless-platform/serverless-reading-list.md", title: "Reading List" },
    "/ml-from-scratch-reading-list": { file: "content/ml-from-scratch-reading-list.md", title: "Reading List" },
};
