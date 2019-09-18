- [Firestore MobX](#Firestore-MobX)
  - [Features](#Features)
  - [Install](#Install)
  - [Usage](#Usage)
  - [Restrictions on Dynamic Data
    Sourcing](#Restrictions-on-Dynamic-Data-Sourcing)
    - [Document](#Document)
    - [Collection](#Collection)
  - [API](#API)

# Firestore MobX

**WARNING** This library is very new. There might still be some fundamental
issues. Until the 1.0 release do not expect this to be suitable for production.

This library was inspired by
[Firestorter](https://github.com/IjzerenHein/firestorter). Read the [migration
docs](/docs/migrate-from-firestorter.md) if you are interested in the motivation
and differences.

You should be able to use this in any Javascript application including React,
React-Native and Node.js.

**NOTE** This library is based on my personal experience using Firestorter. If
there are any features that you miss and deem essential, please let me know. It
is possible that I have overlooked some valid use-cases.

## Features

- Minimal API surface
- Written in Typescript with strict typings
- Minimal dependencies

## Install

`yarn add firestore-mobx` or `npm install firestore-mobx`

## Usage

```ts
import { ObservableDocument, ObservableCollection } from "firestore-mobx";

const author = new ObservableDocument<Author>(
  firestore.doc(`authors/${authorId}`)
);

const books = new ObservableCollection<Book>(
  firestore.collection(`authors/${authorId}/books`),
  ref => ref.orderBy("title", "asc")
);

/**
 * Wait for the data to become available. Alternatively you can observe the
 * author.isLoading property.
 */
await author.ready();

if (!author.exists) {
  console.error(`Failed to find document for author ${author.id}`);
}
/**
 * Get the data. It will be typed on the schema that you passed to the
 * constructor. The data can also be undefined, if the data was not loaded yet
 * or the document did not exist.
 */
console.log(author.data);

/**
 * Switch to different collection source using a collection ref
 */
books.ref = firestore.collection(`authors/${differentAuthorId}/books`);

/**
 * Change the query of a collection by passing a new "query creator function".
 * This function is called with the current collection ref to create a new query.
 */
books.setQuery = ref => ref.orderBy("publishedAt", "desc");

/**
 * Wait for the data to become available. Alternatively you can observe the
 * books.isLoading property.
 */
await books.ready();

if (books.empty) {
  console.error(`Failed to find books for author ${author.id}`);
}

/**
 * Get the data. It will be typed on the schema that you passed to the
 * constructor, wrapped in a Document type which has properties id, data, ref.
 */
books.docs.forEach(doc => console.log(doc.data));
```

## API

See the [API docs](/docs/api.md).
