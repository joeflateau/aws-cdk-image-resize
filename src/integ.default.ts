import { App, RemovalPolicy, Stack } from "aws-cdk-lib/core";
import { ImageResize } from "./index";

const app = new App();
const stack = new Stack(app, "ImageResizeStack");

new ImageResize(stack, "ImageResizeLib", {
  s3BucketOrProps: {
    autoDeleteObjects: true,
    bucketName: "image-resize-lib-test",
    removalPolicy: RemovalPolicy.DESTROY,
  },
  cloudfrontDistributionProps: {
    errorResponses: [
      { httpStatus: 404, responsePagePath: "/path/to/default/object" },
    ],
  },
});
