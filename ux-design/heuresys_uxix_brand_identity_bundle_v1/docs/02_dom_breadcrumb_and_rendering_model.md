# 02 — DOM, Breadcrumb and Rendering Model

## DOM definition

DOM means Document Object Model. It is the browser's live tree representation of the rendered web page.

The DOM is not simply the HTML file. It is the interactive runtime structure that JavaScript, React and the browser update as the user interacts with the application.

## Heuresys rendering model

There is one browser DOM for the loaded application page. Inside it, each area of the dashboard is represented as a DOM subtree.

```text
Browser DOM
└── Dashboard Shell
    ├── Header DOM subtree
    ├── Sidebar DOM subtree
    ├── Main Content DOM subtree
    │   └── Selected Module Page
    │       └── Selected Top Tab View
    └── Footer DOM subtree
```

## Component tree and DOM subtree

Each page or view is not itself "a DOM". More precisely, each page/view is a React component tree that the browser represents as a DOM subtree.

Correct wording:

> Each top tab maps to a routed view, nested route or component tree rendered within the page content region. The browser represents that rendered view as a DOM subtree.

## Breadcrumb definition

A breadcrumb is a contextual navigation trail that shows where the user is inside the platform hierarchy.

Example:

```text
Dashboard / Positions / Catalogue
```

It indicates:

```text
Dashboard
└── Positions
    └── Catalogue
```

## Breadcrumb role

Breadcrumbs help the user understand:

- Where they are.
- Which module they are inside.
- How deep they are in the navigation.
- How to move back to a parent level.

## Breadcrumb is not sidebar or top tabs

- Sidebar = primary navigation.
- Top tabs = secondary navigation within a module.
- Breadcrumb = contextual orientation and parent navigation.

## Architectural statement

A breadcrumb is a contextual navigation trail displayed in the dashboard shell or page header, showing the current page's position within the platform hierarchy and allowing the user to return to parent navigation levels.
