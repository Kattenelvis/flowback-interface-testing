import numpy as np


# There are no current evaluations, because the evaluation phase is after betting phase
def probability_estimation(historical_bets, historical_evaluations, current_bets):
    # Calculates bias for each better
    # https://en.wikipedia.org/wiki/Bias_of_an_estimator#Definition
    # Where every bet has equal probability, so it's just divided by 1/n, hence the error_sum being just the average
    def bias_estimation(historical_bets):
        bias = 0
        for i in range(len(historical_bets)):
            assert 0 <= historical_bets[i] <= 1, "Bets must be between 0 and 1"

            # Make sure the evaluation exists
            if i < len(historical_evaluations):
                # Some bets might not have been evaluated yet
                bias += historical_bets[i] - historical_evaluations[i]

        return bias / len(historical_bets)

    # Calculate bias for each better
    def bias_estimation_all(historical_bets, historical_evaluations):
        biases = []
        for i in range(len(historical_bets)):
            biases.append(
                bias_estimation(historical_bets[i])
            )
        return biases

    bias = np.array(bias_estimation_all(historical_bets, historical_evaluations))
    print(bias)

    # bias = (sum(B_i - x_i))/N
    def bias_adjustment(bets, bias):
        adjusted_bets = []
        for i in range(len(bets)):
            adjusted_bet = bets[i] - bias

            # Make sure the adjusted bet is between 0 and 1
            adjusted_bet = max(0, min(1, adjusted_bet))
            adjusted_bets.append(adjusted_bet)
        return np.array(adjusted_bets)

    # b_j = B_j - bias_j
    # The first F_T in Grangers paper
    def bias_adjustment_all(current_bets, bias):
        adjusted_current_bets = []
        for i in range(len(current_bets)):
            temp = []
            for j in range(len(current_bets[i])):
                temp.append(bias_adjustment(current_bets[i], bias[i]))

            adjusted_current_bets.append(np.array(temp))

        return adjusted_current_bets

    adjusted_current_bets = bias_adjustment_all(current_bets, bias)
    print("Adjusted current bets:", adjusted_current_bets)

    # The second F_T in Grangers paper
    adjusted_historical_bets = []
    for i in range(len(historical_bets)):
        adjusted_historical_bets.append(bias_adjustment(historical_bets[i], bias[i]))

    print("Adjusted historical bets:", adjusted_historical_bets)

    # Calculate e's
    errors = []
    for i in range(len(historical_bets)):
        errors.append(historical_evaluations[i] - adjusted_historical_bets[i])

    def drop_incomparable_values(arr_1, arr_2):
        drop_list = []

        for i in range(len(arr_1)):
            if arr_1[i] is None or arr_2[i] is None:
                drop_list.append(i)

        arr_1 = np.delete(arr_1, drop_list)
        arr_2 = np.delete(arr_2, drop_list)

        return arr_1, arr_2

    def covariance(arr_1, arr_2):
        covariance_array = [
            (arr_1[i] - np.mean(arr_1)) * (arr_2[i] - np.mean(arr_2))
            for i in range(len(arr_1))
        ]
        return (1 / len(arr_1)) * sum(covariance_array)

    covariance_matrix = []
    for k in range(len(errors)):
        row = []

        for j in range(len(errors)):
            comparable_errors = drop_incomparable_values(errors[k], errors[j])
            row.append(covariance(comparable_errors[0], comparable_errors[1]))

        covariance_matrix.append(row)

    inverse_covariance_matrix = np.linalg.pinv(covariance_matrix)
    column_one_vector = np.ones((len(covariance_matrix), 1))
    row_one_vector = np.ones((1, len(covariance_matrix)))
    print("Covariance matrix:", covariance_matrix)
    # Calculate covariance matrix
    # Calculate per row/column, ignore the E

    nominator = np.matmul(inverse_covariance_matrix, column_one_vector)

    denominator_vector = np.matmul(inverse_covariance_matrix, row_one_vector)
    denominator = np.matmul(row_one_vector, denominator_vector)

    small_decimal = 10**-7
    if denominator == 0:
        denominator = small_decimal

    bet_weights = nominator / denominator
    transposed_bet_weights = np.transpose(bet_weights)

    print("Transposed_bet_weights:", transposed_bet_weights)
    
    # Edgecase: All bets are the same
    # Edgecase: No bets have been done
    # Edgecase: One better has made no bets
    # Edgecase: One better has made all bets
    # Edgecase: Evaluation has reached 50% on the vote (in this instance it counts as not evaluated)


# Inputs: All historical bets, bets for the current poll, evaluations

# Example historical bets from 2 betters
historical_bets = (
    np.array([0.6, 0.2, 0.8, 0.6]),
    np.array([0, 1, 0.2, 0.4, 0.6]),
)

# Example evaluations (1 for correct, 0 for incorrect)
historical_evaluations =[1, 0, 1, 0]

# Example current bets
current_bets = (np.array([0.7, 1, 0.8, 0.5]), np.array([0.2, 0.4]))

probability_estimation(historical_bets, historical_evaluations, current_bets)
