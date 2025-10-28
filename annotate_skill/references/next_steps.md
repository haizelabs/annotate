# Next Steps

## Productionizing the AI Judge

The AI judge in this setup depends on a few components:
- The ingestion pipeline which takes your raw trace data and normalizes it to a general schema
- We then take some granularity of this general schema and summarize/extract out the particular prompt variables fed into the rubric
- We pass the rubric + extracted variables through an LLM

If you find the rubric useful, we'll want to translate this pipeline to a repeatable judge in your ideal eval setup. Iterate with the user on a workflow that takes in a unit of their RAW data (or even data of an entirely different format for whatever their unit testing setup is - clarify this with them) and applies the rubric to that raw data.

This may require:
- A 2-step LLM-as-a-judge setup (extract then judge)
- Defining a more deterministic flow, e.g. extract XYZ fields from the raw trace data

For this, confirm with the user:
1. What library/unit testing setup they are most comfortable with
2. Translate the pipeline we've built:
   - `ingest.py` + attribute matcher exclusion
   - Search for `summarize_for_judge_input` function in `scripts/_annotation_utils.py`
   - Search for `create_ai_annotation` in `scripts/_test_case_processor.py`

Some possible directions a user might take, for example, is to:
**Converting this pipeline to an Inspect scorer**
- [Inspect Scorers Documentation](https://inspect.aisi.org.uk/scorers.html)

**Converting the pipeline to a Pydantic AI eval**
- [Pydantic AI Full Documentation](https://ai.pydantic.dev/llms-full.txt) (fetch this raw text file and then search for evals documentation)


## Solidifying the Annotations UX

The user may also want to take inspiration from the particular annotation UX they've arrived at with this skill.

As a reminder, the variable components are:
- **Granularity:** What level of their data do they want to annotate (`granularity` - step vs interaction vs interaction group)?
- **Aspects:** What specific aspects of their agent logs do they want to annotate (e.g. AI rubric prompt variables)?
- **Output format:** What is the result of this annotation (ranking vs pointwise (categorical | continuous))?

**More open-ended questions you may have done discovery on / should ask the user about:**
- Perhaps the data is structured in a way that the user can very quickly scan multiple interactions and annotate them all at once - an interface that supports rapid scanning would be helpful for this
- Perhaps the data is very involved and the user needs to spend multiple minutes even on a single agent interaction - an interface that supports deep analysis and multiple places to comment would be helpful for this
- and more...

As you can see, the particular annotation interface is completely open-ended. The `frontend` directory under the root skill directory provides a starting point with some UI components to visualize multiple levels of granularity of AI interactions. There's also variability in terms of how data is fed into the annotations ux (they probably dont want to depend on our data models). Take inspiration from these components and iterate with the annotator to polish a bespoke UX ideal for their use case.


### MOST IMPORTANTLY
Do not jump the gun here; very clearly make sure you and the user are aligned on the final result. DO NOT just try to get something working, e.g. a random eval script
that just happens to be using the framework they want. We want to carefully think about how to integrate all the work we've done into an *actual setup* that is useful.