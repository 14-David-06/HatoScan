#!/usr/bin/env sh
# Crea el bucket privado de HatoScan y el usuario IAM de la web (ADR 0006, docs/despliegue.md).
# Uso: sh infra/aws/setup-s3.sh <bucket> <región> <origen-de-la-app>
#   ej: sh infra/aws/setup-s3.sh sirius-hatoscan-prod us-east-1 https://hatoscan.vercel.app
# Requiere AWS CLI con sesión en la cuenta de Sirius Regenerative (aws login / aws sso login).
# Se puede volver a ejecutar: actualiza la configuración; solo crea llaves si el usuario no tiene.
set -eu

BUCKET=${1:?bucket}
REGION=${2:?región}
ORIGIN=${3:?origen de la app, ej. https://hatoscan.vercel.app}
USER_NAME=hatoscan-web
DIR=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

render() { sed -e "s|__BUCKET__|$BUCKET|g" -e "s|__APP_ORIGIN__|$ORIGIN|g" "$DIR/$1" > "$TMP/$1"; }
for f in cors.json lifecycle.json bucket-policy.json web-user-policy.json; do render "$f"; done

echo "Cuenta: $(aws sts get-caller-identity --query Account --output text)"

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket $BUCKET ya existe."
elif [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
fi

aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-ownership-controls --bucket "$BUCKET" \
  --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "file://$TMP/cors.json"
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration "file://$TMP/lifecycle.json"
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "file://$TMP/bucket-policy.json"
echo "Bucket listo: privado, cifrado, CORS para $ORIGIN, subidas huérfanas se borran a las 24 h."

aws iam get-user --user-name "$USER_NAME" >/dev/null 2>&1 || aws iam create-user --user-name "$USER_NAME" >/dev/null
aws iam put-user-policy --user-name "$USER_NAME" --policy-name hatoscan-s3 \
  --policy-document "file://$TMP/web-user-policy.json"

KEYS=$(aws iam list-access-keys --user-name "$USER_NAME" --query 'length(AccessKeyMetadata)' --output text)
if [ "$KEYS" = "0" ]; then
  echo
  echo "Llave nueva de $USER_NAME. Cópiala a Vercel (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY) y no la guardes en otro lado:"
  aws iam create-access-key --user-name "$USER_NAME" \
    --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text
else
  echo "$USER_NAME ya tiene llave; no se crea otra."
fi

echo
echo "Detector (Vercel): DETECTOR_ALLOWED_IMAGE_HOSTS=[\"$BUCKET.s3.$REGION.amazonaws.com\"]"
