# Readme

## Intro

<!--main-description-start-->

OpenCloning is an Open-Source web application to plan and document cloning. Users can:

* 📡 Import plasmid sequences from AddGene and gene sequences from NCBI.
* 📁 Load their own sequence files.
* 🧬 Plan cloning and design primers using common techniques (Gibson, golden gate, gateway, etc.).
* 🦠 Plan strain and cell line engineering via CRISPR and homologous recombination, with use-cases not supported by SnapGene or Benchling.
* 🤖 Automate repetitive cloning and primer design using scripts or web forms.
* 💾 Download final constructs as GenBank or FASTA files.
* 📜 Archive the entire cloning history in an Open format and load it later.
* 🛠️ Create reusable cloning templates for cloning kits.

<!--main-description-end-->

To learn more, visit:
* 🌐 The hosted app: https://app.opencloning.org/
* 📽️ The demo videos: https://www.youtube.com/watch?v=n0hedzvpW88&t=158s&ab_channel=Genestorian


<!--running-locally-start-->

## ⏲️ Getting started in 5 minutes

If you just want to try the application, the easiest way is to go to the hosted version at: [https://app.opencloning.org/](https://app.opencloning.org/).

If you want to quickly set up a local instance of the application using docker, you can clone this repository, and from the root directory call:

```bash
# see docker-compose.yml
docker-compose up
```

The application should be running at [http://localhost:8000](http://localhost:8000).

This uses the provided `docker-compose.yaml`.

## Scripting

You can use the backend library to script and automate cloning design. Have a look at the [scripting documentation](https://pydna.readthedocs.io/latest/notebooks/history.html) for more information.

## Running it yourself using docker in a single container

You can use the image [manulera/opencloning](https://hub.docker.com/r/manulera/opencloning), and use `docker-compose.yaml` as a starting point. The important information to know is that:

* The image exposes port 8000.
* You can configure several things via ENV variables, see the comments in the `docker-compose.yaml` file:
  * Proxy for external requests
  * Usage of HTTPS
  * Root path at which the app is served
  * Allowed origins for CORS
* This container serves both the frontend and the backend, but you can run them as separate containers (will need CORS configuration).

```bash
docker pull manulera/opencloning
docker run -p 8000:8000 manulera/opencloning
```

### Running an instance in GitHub Codespaces

* Click the menu at the top left of the github website, then click codespaces
* On the top-right click on `New codespace`
* On `Repository` select `OpenCloning/OpenCloning`
* Click on `Create codespace`
* In the terminal enter `docker-compose up`
* Once complete a popup will appear saying port 8000 is now available, click `Open in Browser` to navigate to your own version of the OpenCloning app
* Optional: To share with other users, navigate to the ports tab of the github codespace and right click and change port visibility to public


## Running it yourself and configuration

This repository contains the whole application:

* [`python/`](python/): the backend, a web API built with FastAPI, and the Python packages (`opencloning`, `opencloning-db`, `opencloning-cli`, `opencloning-mcp`). See its [README](python/README.md).
* [`js/`](js/): the frontend, a React application (the "family tree builder" that you see in your browser), and the `@opencloning/*` npm packages. See its [README](js/README.md).

### Development

The easiest way to work on the code is the dev container in [`.devcontainer/`](.devcontainer/) (see its [README](.devcontainer/README.md)), which has everything installed. Common tasks are recipes in the [`justfile`](justfile); run `just` to list them, for example:

```bash
just install        # install Python and JS dependencies
just dev-cloning    # cloning API + frontend in one terminal (Ctrl+C stops both)
just pytest         # Python tests
just vitest         # JS unit tests
```

<!--running-locally-end-->

## About

### 🧬 Biological background

Recombinant DNA technology is used in a variety of research and industry fields to generate new DNA molecules by combining fragments of existing ones. This means that every molecule in a laboratory collection was created by "cutting and pasting" the sequences of existing molecules.

The aim of this application is to provide a web interface to document the generation of new DNA molecules from existing ones, and to export this information to share it with others. You can imagine it as a family tree builder, where there are two kinds of entities:

1. The `sequences`, which are the DNA molecules.
2. The `sources`, which are experimental steps that take 0 or more `sequences` as an input, and generate a single output. There can be two kinds of `sources`:
	1.	**`Sources` without a parent `sequence`:** They represent the source of a DNA molecule received externally (e.g., a plasmid received from a collaborator or from Addgene) or a naturally occurring sequence (e.g., given by an assembly identifier and genome coordinates).
	2. **`Sources` representing cloning steps combining existing `sequences` to generate new `sequences`:** They contain references to the input and output DNA sequences, the method name (digestion, ligation, etc.) and the minimal information to do the cloning step in silico.

See the figure below for an example of PCR-based gene targeting, in which a fragment of a plasmid is amplified by PCR with primers that contain 5' extensions homologous to target sequences in the genome. Cells are then transformed with the PCR fragment, which integrates into the genome through homologous recombination.

![](cloning.drawio.svg)

You can see how the workflow of cloning happens in the app in [this video](https://www.youtube.com/watch?v=n0hedzvpW88&ab_channel=Genestorian)

### Encoding this information

The data model is built using the [LinkML](https://linkml.io/) framework, and can be accessed in [this repository](https://github.com/OpenCloning/OpenCloning_LinkML).

For an example of the data model to represent an homologous recombination, you can see [this json file](js/apps/opencloning/public/examples/homologous_recombination.json).

From the json, you can see how every `sequence` comes from a `source`, and every `sequence` can be the input of another `source`. The application frontend provides an interface where the user can specify a `source` (with or without inputs). This `source` is sent to the backend in a `POST` request, where the step encoded in the `source` is executed, and the output `sequence` is returned and displayed in the frontend. When multiple outputs could come out of a `source` (for example, a restriction enzyme digestion), the user can select which one of them is the desired output. Then the user can use the output `sequence` as an input for a new `source`, and so on.

## Dependencies

You can find the full dependency list in [`python/`](python/pyproject.toml) and [`js/`](js/package.json), but it's worth mentioning two key ones:

* [pydna](https://github.com/pydna-group/pydna), a python library that extends [BioPython](https://biopython.org/) `Seq` and `SeqRecord` classes to represent overhangs and circularity. And implements functions to simulate DNA sequence operations (golden gate, gibson, etc.).
* [LinkML](https://linkml.io/) a framework for developing data models, which allows users to define their data model as a yaml file, and generate code in different programming languages to work with it.

## Contributing

If you are interested in contributing, check the [contribution guidelines](CONTRIBUTING.md).

## Acknowledgements 🙏

Thanks to [@ikayz](https://github.com/ikayz) for initial improvements to the frontend.

Thanks to [@joyceykao](https://github.com/joyceykao) for discussions on how to approach UI/UX and users interview.

Thanks to [@maratumba](https://github.com/maratumba) for recommending the usage of FastAPI and for giving some general guidelines for the development of the backend and hosting.

Thanks to the whole [Open Life Science](https://openlifesci.org/) organising team and community, which were incredibly helpful in setting the foundations of this project. Special thanks to [@DimmestP](https://github.com/DimmestP), who mentored [@manulera](https://github.com/DimmestP) during the program [OLS-4](https://openlifesci.org/ols-4).

## Submodules

I add submodules for agents to be able to give better suggestions (e.g. tg-oss).
