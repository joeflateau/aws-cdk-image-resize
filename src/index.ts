import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Duration } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { DistributionProps, FunctionProps } from "./types";
export * from "./types";

export interface IImageResizeProps {
  createDistribution?: boolean;
  cloudfrontDistributionProps?: DistributionProps;
  originResponseLambdaProps?: NodejsFunctionProps;
  s3BucketOrProps?: s3.Bucket | s3.BucketProps;
  viewerRequestLambdaProps?: FunctionProps;
}

export class ImageResize extends Construct {
  distribution: cloudfront.Distribution | null;
  imageOriginResponseLambda: NodejsFunction;
  imagesBucket: s3.Bucket;
  imageViewerRequestLambda: lambda.Function;
  behaviorOptions: cloudfront.BehaviorOptions;

  constructor(scope: Construct, id: string, props?: IImageResizeProps) {
    super(scope, id);

    const {
      s3BucketOrProps,
      originResponseLambdaProps,
      viewerRequestLambdaProps,
      cloudfrontDistributionProps,
      createDistribution,
    } = props || {};

    this.imagesBucket =
      s3BucketOrProps instanceof s3.Bucket
        ? s3BucketOrProps
        : new s3.Bucket(this, "Bucket", s3BucketOrProps);

    this.imageOriginResponseLambda = new NodejsFunction(
      this,
      "OriginResponseFunction",
      {
        bundling: {
          minify: true,
          nodeModules: ["sharp"],
        },
        entry: `${__dirname}/../lambda/image-origin-response-function/index.js`,
        functionName: "image-origin-response-function",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_12_X,
        timeout: Duration.seconds(15),
        ...originResponseLambdaProps,
      }
    );

    this.imagesBucket.grantRead(this.imageOriginResponseLambda);
    this.imagesBucket.grantPut(this.imageOriginResponseLambda);

    this.imageViewerRequestLambda = new lambda.Function(
      this,
      "ViewerRequestFunction",
      {
        code: lambda.Code.fromAsset(
          `${__dirname}/../lambda/image-viewer-request-function`
        ),
        functionName: "image-viewer-request-function",
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_12_X,
        ...viewerRequestLambdaProps,
      }
    );

    const cachePolicy = new cloudfront.CachePolicy(this, "CachePolicy", {
      cachePolicyName: "images-cache-policy",
      defaultTtl: Duration.days(365), // 1 year
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
      maxTtl: Duration.days(365 * 2), // 2 years
      minTtl: Duration.days(30 * 3), // 3 months
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList(
        "height",
        "width"
      ),
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      "OAI"
    );
    this.imagesBucket.grantRead(originAccessIdentity);

    const behaviorOptions = (this.behaviorOptions = {
      origin: new origins.S3Origin(this.imagesBucket, {
        originAccessIdentity,
      }),
      cachePolicy,
      edgeLambdas: [
        {
          eventType: cloudfront.LambdaEdgeEventType.ORIGIN_RESPONSE,
          functionVersion: this.imageOriginResponseLambda.currentVersion,
        },
        {
          eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          functionVersion: this.imageViewerRequestLambda.currentVersion,
        },
      ],
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      compress: true,
      ...cloudfrontDistributionProps?.defaultBehavior,
    });

    // Cloudfront distribution for the S3 bucket.
    this.distribution = createDistribution
      ? new cloudfront.Distribution(this, "Distribution", {
          ...cloudfrontDistributionProps,
          defaultBehavior: behaviorOptions,
        })
      : null;
  }
}
