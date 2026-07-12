import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getIdType, IdType } from '@colanode/core';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius } from '@colanode/mobile/theme/tokens';
import { fonts } from '@colanode/mobile/theme/typography';
import { useQuery } from '@colanode/ui/hooks/use-query';

interface NodeAvatarProps {
  id: string;
  avatar?: string | null;
  name?: string | null;
  size?: number;
}

const createStyles = (palette: Palette, size: number) =>
  StyleSheet.create({
    circle: {
      width: size,
      height: size,
      borderRadius: radius.full,
      backgroundColor: palette.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    initial: {
      fontFamily: fonts.bodyBold,
      fontSize: size * 0.42,
      color: palette.accentSoftForeground,
    },
    image: { width: size, height: size },
  });

const AvatarImage = ({ avatarId, size }: { avatarId: string; size: number }) => {
  const { account } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette, size), [palette, size]);
  const avatarQuery = useQuery({
    type: 'avatar.get',
    accountId: account.id,
    avatarId,
  });

  if (!avatarQuery.data?.url) {
    return null;
  }
  return <Image source={{ uri: avatarQuery.data.url }} style={styles.image} />;
};

export const NodeAvatar = ({ id, avatar, name, size = 36 }: NodeAvatarProps) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette, size), [palette, size]);
  const isImageAvatar = !!avatar && getIdType(avatar) === IdType.Avatar;
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.circle} testID={`avatar-${id}`}>
      {isImageAvatar ? (
        <AvatarImage avatarId={avatar} size={size} />
      ) : (
        <Text style={styles.initial}>{initial}</Text>
      )}
    </View>
  );
};
