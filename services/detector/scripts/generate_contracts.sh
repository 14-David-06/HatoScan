#!/usr/bin/env sh
# Genera modelos Pydantic desde packages/contracts/schemas (fuente de verdad). No editar app/contracts a mano.
set -eu
cd "$(dirname "$0")/.."
rm -rf app/contracts
uv run datamodel-codegen \
  --input ../../packages/contracts/schemas \
  --input-file-type jsonschema \
  --output app/contracts \
  --output-model-type pydantic_v2.BaseModel \
  --target-python-version 3.11 \
  --use-standard-collections \
  --use-union-operator \
  --use-schema-description \
  --use-title-as-name \
  --enum-field-as-literal all \
  --field-constraints \
  --extra-fields forbid \
  --disable-timestamp \
  --custom-file-header "# AUTO-GENERADO desde packages/contracts/schemas. No editar."
