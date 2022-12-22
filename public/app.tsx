// sampe react app

import * as React from "react";
import * as ReactDOM from "react-dom";

// Component to show publication
const PublicationComponent = (props: any) => {
  return (
    <div>
      <h1>{props.title}</h1>
      <p>{props.text}</p>
      _id: {props._id}

    </div>
  );
};

// List of publications component
const PublicationsComponent = (props: any) => {
  return (
    <div>
      {props.publications.map((publication: any) => {
        return <PublicationComponent key={publication._id} title={publication.title}
        _id={publication._id}
        text={publication.text} />;
      })}
    </div>
  );
};

// Error boundary component
const ErrorBoundary = (props: any) => {
  return (
    <div>
      <h1>Something went wrong</h1>
      <p>{props.error}</p>
    </div>
  );
};

// Search as you type component
const SearchComponent = (props: any) => {
  return (
    <div>
      <input type="text" onChange={props.onSearch} />
    </div>
  );
};

const AddPublicationComponent = (props: any) => {
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");

  return (
    <div>
      <input type="text" onChange={
        (e) => {
          setTitle(e.target.value);
        }

      } />
      <input type="text" onChange={
        (e) => {
          setText(e.target.value);
        }
      } />
      <button onClick={
        () => {
          props.onAdd(title, text);
        }
      }>Add</button>
    </div>
  );
};



const App = () => {
  const [publications, setPublications] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [showAddPublicationForm, setShowAddPublicationForm] = React.useState(false);

  // fetch publications from server
  React.useEffect(() => {
    fetch("/api/publications")
      .then((response) => response.json())
      .then((data) => {
        console.info("Publications fetched", data);
        setPublications(data);
      }).catch((error) => {
        console.error("Error fetching publications", error);
        setError(error);
      })
  }, []);

  // Add error boundary
  if (error) {
    return <ErrorBoundary error={error?.message || String(error)} />;
  }

  return (
    <div>
      <SearchComponent onSearch={(event: any) => {
        console.log(event.target.value);
        fetch(`/api/publications?search=${event.target.value}`)
        .then((response) => response.json())
        .then((data) => {
          console.info("Publications fetched", data);
          setPublications(data);
        });
      }}/>

      <button onClick={() => {
        // Show add publication form
        setShowAddPublicationForm(true);
      }}>Add publication</button>

{showAddPublicationForm ? <AddPublicationComponent 
onAdd={
  (title: string, text: string) => {
    fetch("/api/publications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        text
      })
    }).then((response) => response.json())
    .then((data) => {
      console.info("Publication added", data);
      setPublications([...publications, data]);
      setShowAddPublicationForm(false)
    });
  }
} />
 : <div>

<PublicationsComponent publications={publications} />
      {publications.length === 0 && <p>No publications found</p>}
  </div>}
    </div>
  );
};

// render
ReactDOM.render(<App />, document.getElementById("root"));
