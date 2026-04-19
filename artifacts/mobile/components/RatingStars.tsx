import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface RatingStarsProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onRate?: (stars: number) => void;
}

function RatingStarsComponent({ rating, size = 18, interactive = false, onRate }: RatingStarsProps) {
  const handlePress = useCallback(
    (star: number) => {
      if (interactive && onRate) {
        onRate(star);
      }
    },
    [interactive, onRate],
  );

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rating;
        return interactive ? (
          <Pressable key={star} onPress={() => handlePress(star)} hitSlop={8}>
            <Star
              size={size}
              color={filled ? Colors.star : Colors.starEmpty}
              fill={filled ? Colors.star : 'transparent'}
            />
          </Pressable>
        ) : (
          <Star
            key={star}
            size={size}
            color={filled ? Colors.star : Colors.starEmpty}
            fill={filled ? Colors.star : 'transparent'}
          />
        );
      })}
    </View>
  );
}

export const RatingStars = React.memo(RatingStarsComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
  },
});
