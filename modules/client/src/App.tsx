import {
  Container,
  CssBaseline,
  Theme,
  createStyles,
  makeStyles,
  ThemeProvider,
} from "@material-ui/core";
import React, { useEffect, useState } from "react";
import { Route, Switch, useRouteMatch} from "react-router-dom";
import axios from "axios";

import { Home } from "./components/Home";
import { AdminHome } from "./components/AdminHome";
import { NavBar } from "./components/NavBar";
import { PostPage } from "./components/Posts";
import {
  emptyIndex,
  fetchBranch,
  fetchContent,
  fetchFile,
  fetchIndex,
  getPostsByCategories,
} from "./utils";
import { darkTheme, lightTheme } from "./style";
import { store } from "./utils/cache";
import { AdminContext } from "./AdminContext";
import { SidebarNode } from "./types";
import { CreateNewPost } from "./components/CreateNewPost";

const useStyles = makeStyles((theme: Theme) => createStyles({
  appBarSpacer: theme.mixins.toolbar,
  root: {
    display: "flex",
  },
  container: {
    [theme.breakpoints.up("md")]: {
      width: "80%",
      marginRight: "20%",
    },
  },
  main: {
    flexGrow: 1,
    marginTop: theme.spacing(2),
    padding: theme.spacing(0.25),
  },
}));

const App: React.FC = () => {
  const classes = useStyles();
  const [node, setNode] = useState({} as SidebarNode);
  const [theme, setTheme] = useState(lightTheme);
  const [index, setIndex] = useState(emptyIndex);
  const [title, setTitle] = useState({ site: "", page: "" });
  const [about, setAbout] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [adminMode, setAdminMode] = useState(true);
  const [postContent, setPostContent] = useState({});

  const slugMatch = useRouteMatch("/:slug");
  const refMatch = useRouteMatch("/:ref/:slug");
  const currentRef = refMatch ? refMatch.params.ref : "";
  const currentSlug = refMatch ? refMatch.params.slug : slugMatch ? slugMatch.params.slug : "";
  console.log(`Rendering home page with ref=${currentRef} and slug=${currentSlug}`);

  const updateAuthToken = (authToken: string) => {
    setAuthToken(authToken);
    store.save("authToken", authToken);
  };

  const syncRef = async (
    _ref?: string,
    slug?: string,
  ) => {
    const branch = await fetchBranch()
    const ref = _ref || branch;
    const force = ref === branch; // if not branch, then immutable & never need to force refresh
    const newIndex = await fetchIndex(ref, force);
    setIndex(newIndex);
    if (slug) {
      const newContent = await fetchContent(slug!, ref, force);
      const newPostContent = JSON.parse(JSON.stringify(postContent));
      if (!newPostContent[ref]) {
        newPostContent[ref] = {};
      }
      newPostContent[ref][slug] = newContent;
      setPostContent(newPostContent);
    }
    if (newIndex.about) {
      setAbout(await fetchFile(newIndex.about, ref, force));
    }
  }

  const viewAdminMode = (viewAdminMode: boolean) => setAdminMode(viewAdminMode);

  const toggleTheme = () => {
    if ( theme.palette.type === "dark") {
      store.save("theme", "light");
      setTheme(lightTheme);
    }
    else {
      store.save("theme", "dark");
      setTheme(darkTheme);
    }
  };

  // Run this effect exactly once when the page initially loads
  useEffect(() => {
    window.scrollTo(0, 0);
    syncRef();
    // Set theme to local preference
    const themeSelection = store.load("theme");
    if (themeSelection === "light") setTheme(lightTheme);
    else setTheme(darkTheme);
    // Check local storage for admin edit keys
    const key = store.load("authToken");
    if (key) setAuthToken(key);
  // syncRef doesn't have any 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update auth headers any time the authToken changes
  useEffect(() => {
    axios.defaults.headers.common["authorization"] = `Basic ${btoa(`admin:${authToken}`)}`;
  }, [authToken]);

  // Update the title & sidebar node when the index or slug changes
  useEffect(() => {
    // Update title
    const siteTitle = index ? index.title : "My personal website";
    const pageTitle = index.posts[currentSlug] ? index.posts[currentSlug].title : "";
    document.title = pageTitle ? `${pageTitle} | ${siteTitle}` : siteTitle;
    setTitle({ site: siteTitle, page: pageTitle });
    // Update sidebar node
    if (currentSlug !== "" && index.posts[currentSlug]){
      setNode({ parent: "posts", current: "toc", child: index.posts[currentSlug] });
    } else {
      setNode({ parent: "", current: "categories", child: "posts" });
    }
  }, [currentSlug, index]);

  // Fetch index & post content any time the slug or ref changes
  useEffect(() => {
    (async () => {
      await syncRef(currentRef, currentSlug)
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRef, currentSlug]);

  return (
    <ThemeProvider theme={theme}>
      <AdminContext.Provider
        value={{ syncRef, authToken, index, updateAuthToken, adminMode, viewAdminMode }}
      >
        <CssBaseline />
        <NavBar
          node={node}
          setNode={setNode}
          posts={getPostsByCategories(index.posts)}
          postContent={postContent}
          title={title}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        <main className={classes.main}>
          <div className={classes.appBarSpacer} />
          <Container maxWidth="lg" className={classes.container}>
            <Switch>
              <Route exact
                path="/"
                render={() => {
                  return (
                    <Home
                      posts={index.posts}
                      title={title}
                    />
                  );
                }}
              />
              <Route exact
                path="/about"
                render={() => {
                  return (<PostPage content={index.about ?
                    about
                    : "Not added yet" }
                  />);
                }}
              />
              <Route exact
                path="/admin"
                render={() => {
                  return (
                    <AdminHome />
                  );
                }}
              />
              <Route exact
                path="/create-new-post"
                render={() => {
                  return <CreateNewPost />;
                }}
              />
              <Route
                path="/:ref/:slug"
                render={({ match }) => {
                  const ref = match.params.ref;
                  const slug = match.params.slug;
                  let content = "Loading..."
                  console.log(`Rendering historical data for ref ${ref} and slug ${slug}`);
                  if (postContent[ref] && postContent[ref][slug]) {
                    content = postContent[ref][slug];
                  } else if (!(index.posts[slug] || (index.drafts && index.drafts[slug]))) {
                    content = "Does Not Exist";
                  }
                  return (<PostPage
                    content={content}
                    slug={slug}
                  />);
                }}
              />
              <Route
                path="/:slug"
                render={({ match }) => {
                  const slug = match.params.slug;
                  let content = "Loading..."
                  console.log(`Rendering current data for slug ${slug}`);
                  if (postContent[slug]) {
                    content = postContent[slug];
                  } else if (!(index.posts[slug] || (index.drafts && index.drafts[slug]))) {
                    content = "Does Not Exist"
                  }
                  return (<PostPage
                    content={content}
                    slug={slug}
                  />);
                }}
              />
            </Switch>
          </Container>
        </main>
      </AdminContext.Provider>
    </ThemeProvider>
  );
};

export default App;
