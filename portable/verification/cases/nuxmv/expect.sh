EXPECT_TIMEOUT=180
EXPECT_POS_ARGS='tests/nuxmv/pos.smv'
EXPECT_POS_EXIT=0
EXPECT_POS_REGEX='^-- specification EF s = 7  is true$'
EXPECT_POS_LABEL=PROPERTY_HOLDS
EXPECT_NEG_ARGS='tests/nuxmv/neg.smv'
EXPECT_NEG_EXIT=0
EXPECT_NEG_REGEX='^-- specification AG s <= 5  is false$'
EXPECT_NEG_LABEL=PROPERTY_FAILS
EXPECT_ERR_ARGS='tests/nuxmv/err.smv'
EXPECT_ERR_EXIT=1
EXPECT_ERR_REGEX='line 2: at token "is": syntax error'
EXPECT_ERR_LABEL=ERROR
