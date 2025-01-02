import fs from 'node:fs';
import path from 'node:path';
import AWS from 'aws-sdk';

const fixturesDir = path.join(__dirname, 'fixtures');

async function clearBucket(s3: AWS.S3, bucketName: string): Promise<void> {
  let continuationToken: string | undefined = undefined;

  do {
    const listResponse = await s3
      .listObjectsV2({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      })
      .promise();

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      await s3
        .deleteObjects({
          Bucket: bucketName,
          Delete: {
            Objects: listResponse.Contents.map(({ Key }) => Key)
              .filter((k) => k !== undefined)
              .map((k) => ({ Key: k })),
          },
        })
        .promise();
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);
}

async function uploadDirectoryToS3(s3: AWS.S3, bucketName: string, dirPath: string, baseDir: string): Promise<void> {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const bucketPath = path.join(fixturesDir, bucketName);
    const s3Key = path.relative(bucketPath, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      await uploadDirectoryToS3(s3, bucketName, fullPath, baseDir);
    } else {
      const fileContent = fs.readFileSync(fullPath);
      await s3
        .upload({
          Bucket: bucketName,
          Key: s3Key,
          Body: fileContent,
        })
        .promise();
    }
  }
}

async function main() {
  const s3 = new AWS.S3();
  const bucketDirs = fs.readdirSync(fixturesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  for (const bucketDir of bucketDirs) {
    const bucketName = bucketDir.name;
    const bucketPath = path.join(fixturesDir, bucketName);
    await clearBucket(s3, bucketName);
    await uploadDirectoryToS3(s3, bucketName, bucketPath, bucketPath);
  }
}

main().then();
