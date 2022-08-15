import { Template } from "aws-cdk-lib/assertions";
import * as cdk from "aws-cdk-lib/core";
import { ImageResize } from "../src";

it("Image resize", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app);
  new ImageResize(stack, "TestStack");

  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::Lambda::Function", 2);
  template.resourceCountIs("AWS::S3::Bucket", 1);
  template.resourceCountIs("AWS::CloudFront::Distribution", 1);
});
