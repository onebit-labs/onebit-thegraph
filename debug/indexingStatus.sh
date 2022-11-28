# indexingStatusForPendingVersion
curl --location --request POST 'https://api.thegraph.com/index-node/graphql' \
  --header 'Content-Type: application/json' \
  --data-raw '{"query":"{\n  indexingStatusForPendingVersion(subgraphName: \"rockgold0911/onebit\") {\n    synced\n    health\n    entityCount\n    fatalError {\n      message\n      block {\n        number\n        hash\n      }\n      handler\n    }\n    chains {\n      chainHeadBlock {\n        number\n      }\n      latestBlock {\n        number\n      }\n    }\n  }\n}\n","variables":{}}'
