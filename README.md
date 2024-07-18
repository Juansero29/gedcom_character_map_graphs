# GEDCOM CHARACTER MAP GRAPHS

- [GEDCOM CHARACTER MAP GRAPHS](#gedcom-character-map-graphs)
  - [Main Features](#main-features)
  - [Features I Want To Implement](#features-i-want-to-implement)
  - [Good to know](#good-to-know)
  - [How to contribute](#how-to-contribute)
  - [How To Launch Locally](#how-to-launch-locally)
  - [How To Launch Online](#how-to-launch-online)

This tool to helps me to keep up with the book `Three Body Problem` characters and main events chapter by chapter. But the tools is not only limited to this specific book.

This tool is able to read `.ged` files - which are generally used for genealogy, family trees, etc - and map out in a nice graph each person inside the file, along with all of its details, name, events, notes and quotes. The goal is to be able to easily craft Character Maps for literary works that have complex plots with character-webbing, and be able to keep up with the progress of each chapter accordingly.

The GEDCOM files used in this tool are supposed to be kept simple and strictly referring to the GEDCOM standard (without the extra complex notations of Gramps or other genealogy software).

The `index.html` file proposes a website in which one selects a `*.ged` file, and then the script `graph.js` will process it into a graph using `d3js` that can be searched and dragged around, among other features.

## Main Features

1. Search for any person in the graph
1. Click on a node to show exclusively neighbors (direct relationships)
1. Hover over a relationship link to look at the specifc relationship and any notes that may go alongside it
1. Hover over a node (person) to see its details, full names and nicknames, sex, birth, death, notes, events and quotes.
1. Blood-related people (family) are linked with red thick lines, associated people (friends, acquintances, etc) are linked with black thin lines.
1. Males are blue and Females are pink (yikes toxic sexism, but it's simple...)
1. Deceased characters have a Cross on top of their node

## Features I Want To Implement

1. The script should be able to show correctly `.ged` files generated by GRAMPS, since it's easier to input info that way.
1. Be able to "group" characters in some sort of way, making them float around single "bubbles" in the graph when they belong to the same group.
1. Make it more beautiful.

## Good to know

1. This sofware was completely made with AI, I do not know a thing about JavaScript. Any PRs that I do will probably come from prompting AI and receiving code and features.
1. Most prompts I'm using with AI so that it gives correct results are stored under the `prompts` folder, which are simply text files with a `prompt` extension.
1. You can try the tool by using the `.ged`s under "Three Body Problem", they go along chapter to chapter
1. The `.ged` files chapter by chapter for `Three Body Problem` have been generated by AI aswell. I gave it each chapter in a text file and used specific prompts to make it give back .ged structured data that closely follows the plot of the book. This seems like a great tool to keep up with a book's characters and main events chapter by chapter. That's what makes this tool useful.
1. I made this in a few hours, so don't expect nice code or anything. It's purely a functional tool.

## How to contribute

1. If you like the idea, you can greatly contribute by cross-referencing info in the .ged files. For example, by checking the names, or the facts linked to each person. You can also create new individuals by following the same general structure already present in the files. Chapters 1 to 5 are a bit more wacky as it was the tools beggining, but chapters 5 to 7 are more robust and complex, you can check them for deeper relationships and possibilities. Generally you can refer to the [GEDCOM standard](https://www.gedcom.org/gedcom.html). But again, what I did was letting AI do the heavy lifting by giving it chapters, and asking it to make for me the `.ged` contents how I wanted. After many interations I have a model that knows how to do this quite easily.
1. The idea is to have nice and free character map graphs that are easily navigatable, accessible for everyone, and that facilitate in a lot of was understanding books that have lots of characters and events per characters. Could you imagine this for the whole cast of Game Of Thrones characters? Well, you get the idea. You could start a new PR with the Game Of Thrones cast chapter by chapter if you're unemployed ;)

Have fun!

## How To Launch Locally

1. Execute `node server.js` on the root folder
1. Go to [http://localhost:3000/](http://localhost:3000/)

## How To Launch Online

1. Go to [https://juansero29.github.io/gedcom_character_map_graphs/](https://juansero29.github.io/gedcom_character_map_graphs/)